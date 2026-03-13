import LeaveApplication from "../models/LeaveApplication.js";
import LeaveBalance from "../models/LeaveBalance.js";
import Employee from "../models/Employee.js";
import LeaveType from "../models/LeaveType.js";
import Position from "../models/Position.js";
import Attendance from "../models/Attendance.js";
import MonthlyAttendanceSummary from "../models/MonthlyAttendanceSummary.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate all dates between start and end (inclusive).
 */
const generateDatesFromRanges = (dateRanges) => {
  const allDates = [];
  for (const range of dateRanges) {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    const current = new Date(start);
    while (current <= end) {
      allDates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  return allDates;
};

/**
 * Ensure leave balances exist for an employee for the given year.
 * Uses lazy initialization: creates balances from position → leavePolicy if missing.
 */
const ensureLeaveBalances = async (employeeId, year) => {
  let balances = await LeaveBalance.find({
    employee: employeeId,
    year,
  }).populate("leaveType", "name");

  // If balances already exist, return them
  if (balances.length > 0) {
    return balances;
  }

  // Lazy initialize from employee's position → leavePolicy → entitlements
  const employee = await Employee.findById(employeeId).populate({
    path: "position",
    populate: {
      path: "leavePolicy",
      populate: {
        path: "entitlements.leaveType",
        select: "_id name",
      },
    },
  });

  if (
    !employee?.position?.leavePolicy?.entitlements ||
    employee.position.leavePolicy.status !== "Approved"
  ) {
    return [];
  }

  const entitlements = employee.position.leavePolicy.entitlements;
  const newBalances = [];

  for (const entitlement of entitlements) {
    const balance = await LeaveBalance.create({
      employee: employeeId,
      leaveType: entitlement.leaveType._id,
      totalDays: entitlement.days,
      usedDays: 0,
      remainingDays: entitlement.days,
      year,
    });
    newBalances.push(balance);
  }

  // Re-fetch with populated leaveType
  balances = await LeaveBalance.find({
    employee: employeeId,
    year,
  }).populate("leaveType", "name");

  return balances;
};

/**
 * Format a date as YYYY-MM-DD using local time (avoids UTC timezone shift).
 */
const formatLocalDate = (date) => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeToUTCMidnight = (dateLike) => {
  const d = new Date(dateLike);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

const getEmployeeMonthKey = (employeeId, dateLike) => {
  const d = normalizeToUTCMidnight(dateLike);
  return `${employeeId}__${d.getUTCFullYear()}__${d.getUTCMonth()}`;
};

const refreshMonthlySummary = async (employeeId, year, month) => {
  const startOfMonth = new Date(Date.UTC(year, month, 1));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const records = await Attendance.find({
    employee: employeeId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const summary = {
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    off: 0,
    leave: 0,
    totalWorkingDays: 0,
  };

  for (const rec of records) {
    switch (rec.status) {
      case "Present":
        summary.present++;
        summary.totalWorkingDays++;
        break;
      case "Absent":
        summary.absent++;
        break;
      case "Late":
        summary.late++;
        summary.totalWorkingDays++;
        break;
      case "Half Day":
        summary.halfDay++;
        summary.totalWorkingDays++;
        break;
      case "Off":
        summary.off++;
        break;
      case "Leave":
        summary.leave++;
        break;
    }
  }

  await MonthlyAttendanceSummary.findOneAndUpdate(
    { employee: employeeId, year, month },
    { ...summary },
    { upsert: true, returnDocument: "after" }
  );
};

const refreshSummariesByKeys = async (monthKeys) => {
  if (!monthKeys || monthKeys.size === 0) return;

  const jobs = [];
  for (const key of monthKeys) {
    const [employeeId, year, month] = key.split("__");
    jobs.push(refreshMonthlySummary(employeeId, Number(year), Number(month)));
  }
  await Promise.all(jobs);
};

const removeApprovedLeaveAttendance = async ({
  employeeId,
  leaveApplicationId,
  dates,
}) => {
  if (!employeeId || !leaveApplicationId) return new Set();

  const monthKeys = new Set();
  if (dates?.length) {
    for (const date of dates) {
      monthKeys.add(getEmployeeMonthKey(employeeId, date));
    }
  }

  const recordsToDelete = await Attendance.find({
    employee: employeeId,
    linkedLeaveApplication: leaveApplicationId,
    lockReason: "approved_leave",
  }).select("date");

  for (const rec of recordsToDelete) {
    monthKeys.add(getEmployeeMonthKey(employeeId, rec.date));
  }

  await Attendance.deleteMany({
    employee: employeeId,
    linkedLeaveApplication: leaveApplicationId,
    lockReason: "approved_leave",
  });

  return monthKeys;
};

const upsertApprovedLeaveAttendance = async ({
  employeeId,
  leaveApplicationId,
  dates,
  userId,
}) => {
  if (!employeeId || !leaveApplicationId || !dates?.length) {
    return { monthKeys: new Set(), conflicts: [] };
  }

  const monthKeys = new Set();
  const conflicts = [];

  for (const date of dates) {
    const normalizedDate = normalizeToUTCMidnight(date);
    monthKeys.add(getEmployeeMonthKey(employeeId, normalizedDate));

    const existing = await Attendance.findOne({
      employee: employeeId,
      date: normalizedDate,
    });

    if (
      existing &&
      existing.linkedLeaveApplication &&
      existing.linkedLeaveApplication.toString() !== leaveApplicationId.toString()
    ) {
      conflicts.push(formatLocalDate(normalizedDate));
      continue;
    }

    await Attendance.findOneAndUpdate(
      { employee: employeeId, date: normalizedDate },
      {
        employee: employeeId,
        date: normalizedDate,
        status: "Leave",
        shift: null,
        checkIn: null,
        checkOut: null,
        lateDurationMinutes: 0,
        workHours: null,
        source: "leave_auto",
        lockReason: "approved_leave",
        linkedLeaveApplication: leaveApplicationId,
        markedBy: userId || null,
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  return { monthKeys, conflicts };
};

/**
 * Check if there are any overlapping dates in existing leave applications
 * (excluding rejected applications and optionally excluding a specific application ID)
 */
const checkDateOverlap = async (employeeId, dates, excludeApplicationId = null) => {
  // Find all non-rejected applications for this employee
  const query = {
    employee: employeeId,
    status: { $ne: "Rejected" },
  };
  
  if (excludeApplicationId) {
    query._id = { $ne: excludeApplicationId };
  }

  const existingApplications = await LeaveApplication.find(query);

  // Build a set of existing date strings for fast lookup
  const existingDateSet = new Set();
  for (const app of existingApplications) {
    for (const existingDate of app.dates) {
      existingDateSet.add(new Date(existingDate).setUTCHours(0, 0, 0, 0));
    }
  }

  // Collect all overlapping dates
  const overlappingDates = [];

  for (const requestedDate of dates) {
    const reqTime = new Date(requestedDate).setUTCHours(0, 0, 0, 0);
    if (existingDateSet.has(reqTime)) {
      const dateStr = formatLocalDate(requestedDate);
      if (!overlappingDates.includes(dateStr)) {
        overlappingDates.push(dateStr);
      }
    }
  }

  if (overlappingDates.length > 0) {
    overlappingDates.sort();
    return {
      hasOverlap: true,
      overlappingDates,
    };
  }

  return { hasOverlap: false };
};

const normalizeIncomingDateRanges = (payload = {}) => {
  const { singleDate, dateRanges } = payload;

  if (singleDate) {
    const single = new Date(singleDate);
    if (isNaN(single.getTime())) {
      throw new Error("Invalid singleDate");
    }
    return [
      {
        startDate: single.toISOString(),
        endDate: single.toISOString(),
      },
    ];
  }

  if (!Array.isArray(dateRanges)) return [];

  return dateRanges;
};

// ============================================================================
// CONTROLLERS
// ============================================================================

// @description     Get all leave applications (paginated)
// @route           GET /api/leave-applications
// @access          Admin, Supervisor
export const getAllLeaveApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";

    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $lookup: {
          from: "leavetypes",
          localField: "leaveType",
          foreignField: "_id",
          as: "leaveType",
        },
      },
      { $unwind: "$leaveType" },
    ];

    if (searchText.trim()) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employee.fullName": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "employee.employeeID": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "leaveType.name": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
          ],
        },
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await LeaveApplication.aggregate(countPipeline);
    const totalApplications = countResult[0]?.total || 0;

    // Fetch paginated
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 1,
        "employee._id": 1,
        "employee.fullName": 1,
        "employee.employeeID": 1,
        "leaveType._id": 1,
        "leaveType.name": 1,
        dateRanges: 1,
        dates: 1,
        daysCount: 1,
        reason: 1,
        status: 1,
        appliedBy: 1,
        approvedBy: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const applications = await LeaveApplication.aggregate(pipeline);

    res.json({
      leaveApplications: applications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalApplications / limit),
        totalApplications,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new leave application
// @route           POST /api/leave-applications
// @access          Admin, Supervisor
export const createLeaveApplication = async (req, res, next) => {
  try {
    const { employee, leaveType, reason } = req.body || {};
    let dateRanges;

    try {
      dateRanges = normalizeIncomingDateRanges(req.body || {});
    } catch (parseError) {
      res.status(400);
      throw new Error(parseError.message);
    }

    // Validate employee
    if (!employee) {
      res.status(400);
      throw new Error("Employee is required");
    }
    if (!mongoose.Types.ObjectId.isValid(employee)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }
    const employeeDoc = await Employee.findById(employee);
    if (!employeeDoc) {
      res.status(404);
      throw new Error("Employee not found");
    }

    // Validate leave type
    if (!leaveType) {
      res.status(400);
      throw new Error("Leave type is required");
    }
    if (!mongoose.Types.ObjectId.isValid(leaveType)) {
      res.status(400);
      throw new Error("Invalid leave type ID");
    }
    const leaveTypeDoc = await LeaveType.findById(leaveType);
    if (!leaveTypeDoc) {
      res.status(404);
      throw new Error("Leave type not found");
    }

    // Validate date ranges
    if (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0) {
      res.status(400);
      throw new Error("At least one date range is required");
    }

    for (const range of dateRanges) {
      if (!range.startDate || !range.endDate) {
        res.status(400);
        throw new Error("Each date range must have a start and end date");
      }
      const start = new Date(range.startDate);
      const end = new Date(range.endDate);
      if (end < start) {
        res.status(400);
        throw new Error("End date cannot be before start date");
      }
    }

    // Generate all dates and calculate days count
    const dates = generateDatesFromRanges(dateRanges);
    const daysCount = dates.length;

    if (daysCount === 0) {
      res.status(400);
      throw new Error("No days selected in the date ranges");
    }

    // Check for date overlap with existing leave applications
    const overlapCheck = await checkDateOverlap(employee, dates);
    if (overlapCheck.hasOverlap) {
      const datesList = overlapCheck.overlappingDates.join(", ");
      const datesCount = overlapCheck.overlappingDates.length;
      res.status(400);
      throw new Error(
        `Leave already applied for ${datesCount === 1 ? "date" : "dates"}: ${datesList}. Cannot apply for the same date twice.`
      );
    }

    // Get the year from the first date
    const year = new Date(dateRanges[0].startDate).getUTCFullYear();

    // Ensure leave balances exist and check availability
    const balances = await ensureLeaveBalances(employee, year);
    const balance = balances.find(
      (b) => b.leaveType._id.toString() === leaveType
    );

    if (!balance) {
      res.status(400);
      throw new Error(
        "No leave balance found for this leave type. The employee's leave policy may not include this leave type."
      );
    }

    if (balance.remainingDays < daysCount) {
      res.status(400);
      throw new Error(
        `Insufficient leave balance. Available: ${balance.remainingDays} days, Requested: ${daysCount} days`
      );
    }

    // Determine status based on role
    const isAdmin = req.user.role === ROLES.admin;
    const status = isAdmin ? "Approved" : "Pending";

    // Create the leave application
    const newApplication = new LeaveApplication({
      employee,
      leaveType,
      dateRanges,
      dates,
      daysCount,
      reason: reason?.trim() || "",
      status,
      appliedBy: req.user._id,
      approvedBy: isAdmin ? req.user._id : null,
      createdBy: req.user.name || req.user._id,
    });

    await newApplication.save();

    if (status === "Approved") {
      const attendanceSyncDates = generateDatesFromRanges(newApplication.dateRanges);
      const { monthKeys } = await upsertApprovedLeaveAttendance({
        employeeId: employee,
        leaveApplicationId: newApplication._id,
        dates: attendanceSyncDates,
        userId: req.user._id,
      });

      await refreshSummariesByKeys(monthKeys);
    }

    // Deduct from leave balance (on applying, both Pending and Approved)
    balance.usedDays += daysCount;
    balance.remainingDays = Math.max(0, balance.totalDays - balance.usedDays);
    await balance.save();

    // Populate for response
    const populatedApplication = await LeaveApplication.findById(
      newApplication._id
    )
      .populate("employee", "fullName employeeID")
      .populate("leaveType", "name");

    res.status(201).json(populatedApplication);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update leave application
// @route           PUT /api/leave-applications/:id
// @access          Admin (any status), Supervisor (only Pending)
export const updateLeaveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Application Not Found");
    }

    const application = await LeaveApplication.findById(id);
    if (!application) {
      res.status(404);
      throw new Error("Leave application not found");
    }

    const isAdmin = req.user.role === ROLES.admin;

    // Supervisor can only edit Pending applications
    if (!isAdmin && application.status !== "Pending") {
      res.status(403);
      throw new Error("Only pending applications can be edited");
    }

    const { employee, leaveType, reason } = req.body || {};
    const requestedDateRanges = (() => {
      const body = req.body || {};
      if (Object.prototype.hasOwnProperty.call(body, "singleDate")) return true;
      if (Object.prototype.hasOwnProperty.call(body, "dateRanges")) return true;
      return false;
    })();

    let normalizedDateRanges = null;
    if (requestedDateRanges) {
      try {
        normalizedDateRanges = normalizeIncomingDateRanges(req.body || {});
      } catch (parseError) {
        res.status(400);
        throw new Error(parseError.message);
      }
    }

    // Store old values for balance restoration
    const oldDaysCount = application.daysCount;
    const oldLeaveType = application.leaveType.toString();
    const oldEmployee = application.employee.toString();
    const oldStatus = application.status;
    const oldAttendanceEmployeeId = application.employee.toString();
    const oldAttendanceDates = [...application.dates];

    // Determine the year from existing or new date ranges
    const effectiveDateRanges = normalizedDateRanges || application.dateRanges;
    const year = new Date(effectiveDateRanges[0].startDate).getUTCFullYear();

    // Restore old balance if the application was Pending or Approved (balance was deducted)
    if (oldStatus !== "Rejected") {
      const oldBalances = await ensureLeaveBalances(oldEmployee, year);
      const oldBalance = oldBalances.find(
        (b) => b.leaveType._id.toString() === oldLeaveType
      );
      if (oldBalance) {
        oldBalance.usedDays = Math.max(0, oldBalance.usedDays - oldDaysCount);
        oldBalance.remainingDays = Math.max(
          0,
          oldBalance.totalDays - oldBalance.usedDays
        );
        await oldBalance.save();
      }
    }

    // Update fields
    if (employee) {
      if (!mongoose.Types.ObjectId.isValid(employee)) {
        res.status(400);
        throw new Error("Invalid employee ID");
      }
      const employeeDoc = await Employee.findById(employee);
      if (!employeeDoc) {
        res.status(404);
        throw new Error("Employee not found");
      }
      application.employee = employee;
    }

    if (leaveType) {
      if (!mongoose.Types.ObjectId.isValid(leaveType)) {
        res.status(400);
        throw new Error("Invalid leave type ID");
      }
      const leaveTypeDoc = await LeaveType.findById(leaveType);
      if (!leaveTypeDoc) {
        res.status(404);
        throw new Error("Leave type not found");
      }
      application.leaveType = leaveType;
    }

    if (requestedDateRanges) {
      if (!Array.isArray(normalizedDateRanges) || normalizedDateRanges.length === 0) {
        res.status(400);
        throw new Error("At least one date range is required");
      }
      for (const range of normalizedDateRanges) {
        if (!range.startDate || !range.endDate) {
          res.status(400);
          throw new Error("Each date range must have a start and end date");
        }
        if (new Date(range.endDate) < new Date(range.startDate)) {
          res.status(400);
          throw new Error("End date cannot be before start date");
        }
      }
      application.dateRanges = normalizedDateRanges;
      application.dates = generateDatesFromRanges(normalizedDateRanges);
      application.daysCount = application.dates.length;

      // Check for date overlap (excluding current application)
      const overlapCheck = await checkDateOverlap(
        application.employee,
        application.dates,
        id
      );
      if (overlapCheck.hasOverlap) {
        const datesList = overlapCheck.overlappingDates.join(", ");
        const datesCount = overlapCheck.overlappingDates.length;
        res.status(400);
        throw new Error(
          `Leave already applied for ${datesCount === 1 ? "date" : "dates"}: ${datesList}. Cannot apply for the same date twice.`
        );
      }
    }

    if (reason !== undefined) {
      application.reason = reason?.trim() || "";
    }

    // Validate new balance
    const newEmployee = application.employee.toString();
    const newLeaveType = application.leaveType.toString();
    const newDaysCount = application.daysCount;

    // Only check balance if not Rejected
    if (application.status !== "Rejected") {
      const newBalances = await ensureLeaveBalances(newEmployee, year);
      const newBalance = newBalances.find(
        (b) => b.leaveType._id.toString() === newLeaveType
      );

      if (!newBalance) {
        res.status(400);
        throw new Error(
          "No leave balance found for this leave type"
        );
      }

      if (newBalance.remainingDays < newDaysCount) {
        res.status(400);
        throw new Error(
          `Insufficient leave balance. Available: ${newBalance.remainingDays} days, Requested: ${newDaysCount} days`
        );
      }

      // Deduct new balance
      newBalance.usedDays += newDaysCount;
      newBalance.remainingDays = Math.max(
        0,
        newBalance.totalDays - newBalance.usedDays
      );
      await newBalance.save();
    }

    await application.save();

    const summaryKeysToRefresh = new Set();

    if (oldStatus === "Approved") {
      const removedKeys = await removeApprovedLeaveAttendance({
        employeeId: oldAttendanceEmployeeId,
        leaveApplicationId: application._id,
        dates: oldAttendanceDates,
      });
      for (const key of removedKeys) summaryKeysToRefresh.add(key);
    }

    if (application.status === "Approved") {
      const attendanceSyncDates = generateDatesFromRanges(application.dateRanges);
      const { monthKeys } = await upsertApprovedLeaveAttendance({
        employeeId: application.employee.toString(),
        leaveApplicationId: application._id,
        dates: attendanceSyncDates,
        userId: req.user._id,
      });

      for (const key of monthKeys) summaryKeysToRefresh.add(key);
    }

    await refreshSummariesByKeys(summaryKeysToRefresh);

    const populatedApplication = await LeaveApplication.findById(
      application._id
    )
      .populate("employee", "fullName employeeID")
      .populate("leaveType", "name");

    res.json(populatedApplication);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Approve leave application
// @route           PATCH /api/leave-applications/:id/approve
// @access          Admin
export const approveLeaveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Application Not Found");
    }

    const application = await LeaveApplication.findById(id);
    if (!application) {
      res.status(404);
      throw new Error("Leave application not found");
    }

    if (application.status === "Approved") {
      res.status(400);
      throw new Error("Application is already approved");
    }

    const year = new Date(application.dateRanges[0].startDate).getUTCFullYear();

    // If was Rejected, need to re-deduct balance
    if (application.status === "Rejected") {
      const balances = await ensureLeaveBalances(
        application.employee.toString(),
        year
      );
      const balance = balances.find(
        (b) =>
          b.leaveType._id.toString() === application.leaveType.toString()
      );

      if (balance) {
        if (balance.remainingDays < application.daysCount) {
          res.status(400);
          throw new Error(
            `Insufficient leave balance to approve. Available: ${balance.remainingDays} days, Required: ${application.daysCount} days`
          );
        }
        balance.usedDays += application.daysCount;
        balance.remainingDays = Math.max(
          0,
          balance.totalDays - balance.usedDays
        );
        await balance.save();
      }
    }
    // If was Pending, balance already deducted on creation — no change needed

    application.status = "Approved";
    application.approvedBy = req.user._id;
    await application.save();

    const attendanceSyncDates = generateDatesFromRanges(application.dateRanges);
    const { monthKeys } = await upsertApprovedLeaveAttendance({
      employeeId: application.employee.toString(),
      leaveApplicationId: application._id,
      dates: attendanceSyncDates,
      userId: req.user._id,
    });

    await refreshSummariesByKeys(monthKeys);

    const populatedApplication = await LeaveApplication.findById(
      application._id
    )
      .populate("employee", "fullName employeeID")
      .populate("leaveType", "name");

    res.json({
      message: "Leave application approved successfully",
      leaveApplication: populatedApplication,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Reject leave application
// @route           PATCH /api/leave-applications/:id/reject
// @access          Admin
export const rejectLeaveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Application Not Found");
    }

    const application = await LeaveApplication.findById(id);
    if (!application) {
      res.status(404);
      throw new Error("Leave application not found");
    }

    if (application.status === "Rejected") {
      res.status(400);
      throw new Error("Application is already rejected");
    }

    // Restore balance since rejection undoes the deduction
    const year = new Date(application.dateRanges[0].startDate).getUTCFullYear();
    const balances = await ensureLeaveBalances(
      application.employee.toString(),
      year
    );
    const balance = balances.find(
      (b) =>
        b.leaveType._id.toString() === application.leaveType.toString()
    );

    if (balance) {
      balance.usedDays = Math.max(
        0,
        balance.usedDays - application.daysCount
      );
      balance.remainingDays = Math.max(
        0,
        balance.totalDays - balance.usedDays
      );
      await balance.save();
    }

    const removedSummaryKeys = await removeApprovedLeaveAttendance({
      employeeId: application.employee.toString(),
      leaveApplicationId: application._id,
      dates: application.dates,
    });

    application.status = "Rejected";
    application.approvedBy = req.user._id;
    await application.save();

    await refreshSummariesByKeys(removedSummaryKeys);

    const populatedApplication = await LeaveApplication.findById(
      application._id
    )
      .populate("employee", "fullName employeeID")
      .populate("leaveType", "name");

    res.json({
      message: "Leave application rejected successfully",
      leaveApplication: populatedApplication,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete leave application
// @route           DELETE /api/leave-applications/:id
// @access          Admin (any), Supervisor (only Pending)
export const deleteLeaveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Application Not Found");
    }

    const application = await LeaveApplication.findById(id)
      .populate("employee", "fullName employeeID")
      .populate("leaveType", "name");

    if (!application) {
      res.status(404);
      throw new Error("Leave application not found");
    }

    const isAdmin = req.user.role === ROLES.admin;

    // Supervisor can only delete Pending applications
    if (!isAdmin && application.status !== "Pending") {
      res.status(403);
      throw new Error("Only pending applications can be deleted");
    }

    // Restore balance if application was not Rejected
    if (application.status !== "Rejected") {
      const year = new Date(
        application.dateRanges[0].startDate
      ).getUTCFullYear();
      const balances = await ensureLeaveBalances(
        application.employee._id.toString(),
        year
      );
      const balance = balances.find(
        (b) =>
          b.leaveType._id.toString() === application.leaveType._id.toString()
      );

      if (balance) {
        balance.usedDays = Math.max(
          0,
          balance.usedDays - application.daysCount
        );
        balance.remainingDays = Math.max(
          0,
          balance.totalDays - balance.usedDays
        );
        await balance.save();
      }
    }

    const removedSummaryKeys = await removeApprovedLeaveAttendance({
      employeeId: application.employee._id.toString(),
      leaveApplicationId: application._id,
      dates: application.dates,
    });

    await application.deleteOne();

    await refreshSummariesByKeys(removedSummaryKeys);

    res.json({
      message: "Leave application deleted successfully",
      deletedApplication: {
        id: application._id,
        employee: application.employee?.fullName,
        leaveType: application.leaveType?.name,
        daysCount: application.daysCount,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get employee leave balance for current year
// @route           GET /api/leave-applications/balance/:employeeId
// @access          Admin, Supervisor
export const getEmployeeLeaveBalance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const employeeDoc = await Employee.findById(employeeId);
    if (!employeeDoc) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const currentYear = new Date().getFullYear();
    const balances = await ensureLeaveBalances(employeeId, currentYear);

    res.json({
      employee: {
        _id: employeeDoc._id,
        fullName: employeeDoc.fullName,
        employeeID: employeeDoc.employeeID,
      },
      year: currentYear,
      balances: balances.map((b) => ({
        leaveType: b.leaveType,
        totalDays: b.totalDays,
        usedDays: b.usedDays,
        remainingDays: b.remainingDays,
      })),
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
