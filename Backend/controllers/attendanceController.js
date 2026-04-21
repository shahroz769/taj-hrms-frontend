import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import MonthlyAttendanceSummary from "../models/MonthlyAttendanceSummary.js";
import Employee from "../models/Employee.js";
import EmployeeShift from "../models/EmployeeShift.js";
import Shift from "../models/Shift.js";
import LeaveApplication from "../models/LeaveApplication.js";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Day-of-week name from a Date (UTC).
 * Returns "Monday", "Tuesday", etc.
 */
const getDayName = (date) => {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[date.getUTCDay()];
};

/**
 * Build a Date from a date + "HH:MM" time string (UTC).
 * Returns null if timeStr is missing or invalid.
 */
const buildDateTimeFromShiftTime = (date, timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const parts = timeStr.split(":");
  if (parts.length < 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const dt = new Date(date);
  if (isNaN(dt.getTime())) return null;
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
};

/** Safely parse a date string; returns null if the result is Invalid Date. */
const safeDateParse = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

const normalizeUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const getEmploymentBounds = (employee) => {
  const joiningDate = normalizeUtcDate(employee?.joiningDate);
  const resignationDate = normalizeUtcDate(employee?.resignationDate);
  return { joiningDate, resignationDate };
};

const getEmploymentBoundaryError = (dateUTC, employee) => {
  const { joiningDate, resignationDate } = getEmploymentBounds(employee);

  if (joiningDate && dateUTC < joiningDate) {
    return `Attendance date is before joining date (${joiningDate
      .toISOString()
      .split("T")[0]}).`;
  }

  if (resignationDate && dateUTC > resignationDate) {
    return `Attendance date is after resignation date (${resignationDate
      .toISOString()
      .split("T")[0]}).`;
  }

  return null;
};

const ATTENDANCE_RULES = {
  graceMinutes: 15,
  absentAfterLateMinutes: 60,
  halfDayEarlyLeaveMinutes: 60,
};

const TIMED_STATUSES = ["Present", "Late", "Half Day"];

const computeStatusFromCheckTimes = ({
  requestedStatus,
  shift,
  date,
  checkIn,
  checkOut,
}) => {
  const nonTimedStatuses = ["Leave", "Off", "Absent"];
  if (requestedStatus && nonTimedStatuses.includes(requestedStatus)) {
    return requestedStatus;
  }

  if (!shift || !date) {
    return requestedStatus || "Present";
  }

  const shiftStart = buildDateTimeFromShiftTime(date, shift.startTime);
  const shiftEnd = buildDateTimeFromShiftTime(date, shift.endTime);

  if (!shiftStart || !shiftEnd) {
    return requestedStatus || "Present";
  }

  let computedStatus = "Present";

  if (checkIn) {
    const lateMinutes = Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000);
    if (lateMinutes >= ATTENDANCE_RULES.absentAfterLateMinutes) {
      return "Absent";
    }
    if (lateMinutes > ATTENDANCE_RULES.graceMinutes) {
      computedStatus = "Late";
    }
  }

  if (checkOut) {
    const earlyLeaveMinutes = Math.floor((shiftEnd.getTime() - checkOut.getTime()) / 60000);
    if (earlyLeaveMinutes >= ATTENDANCE_RULES.halfDayEarlyLeaveMinutes) {
      if (computedStatus !== "Absent") {
        computedStatus = "Half Day";
      }
    }
  }

  return computedStatus;
};

const computeLateMinutesFromCheckIn = ({ shift, date, checkIn }) => {
  if (!shift || !date || !checkIn) return 0;
  const shiftStart = buildDateTimeFromShiftTime(date, shift.startTime);
  if (!shiftStart) return 0;
  const diff = Math.floor((checkIn.getTime() - shiftStart.getTime()) / 60000);
  return diff > 0 ? diff : 0;
};

const ensureCheckTimesForTimedStatus = ({
  status,
  date,
  shift,
  checkIn,
  checkOut,
}) => {
  if (!TIMED_STATUSES.includes(status)) {
    return { checkIn, checkOut };
  }

  const resolvedCheckIn =
    checkIn || (shift ? buildDateTimeFromShiftTime(date, shift.startTime) : null);
  const resolvedCheckOut =
    checkOut || (shift ? buildDateTimeFromShiftTime(date, shift.endTime) : null);

  if (!resolvedCheckIn || !resolvedCheckOut) {
    throw new Error(
      "Check-in and check-out are required for Present/Late/Half Day attendance.",
    );
  }

  return {
    checkIn: resolvedCheckIn,
    checkOut: resolvedCheckOut,
  };
};

const isApprovedLeaveLockedRecord = (attendanceRecord) => {
  return (
    attendanceRecord?.lockReason === "approved_leave" ||
    (attendanceRecord?.source === "leave_auto" &&
      !!attendanceRecord?.linkedLeaveApplication)
  );
};

const hasApprovedLeaveOnDate = async (employeeId, dateUTC) => {
  const dayStart = new Date(dateUTC);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dateUTC);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const approvedLeave = await LeaveApplication.findOne({
    employee: employeeId,
    status: "Approved",
    dates: { $elemMatch: { $gte: dayStart, $lte: dayEnd } },
  }).select("_id");

  return !!approvedLeave;
};

/**
 * Given a sorted-ascending array of EmployeeShift assignment objects (populated shift),
 * return the shift's workingDays array that was active on the given UTC-midnight Date.
 * Returns null if no assignment covers that date.
 */
const getWorkingDaysForDate = (assignments, dateUTC) => {
  let result = null;
  for (const a of assignments) {
    const effective = new Date(a.effectiveDate);
    effective.setUTCHours(0, 0, 0, 0);
    if (effective > dateUTC) continue; // assignment hadn't started yet
    if (a.endDate) {
      const end = new Date(a.endDate);
      end.setUTCHours(0, 0, 0, 0);
      if (end < dateUTC) continue; // assignment had already ended
    }
    result = a.shift?.workingDays || null;
  }
  return result;
};

/**
 * Recompute and upsert the MonthlyAttendanceSummary for a specific employee-month.
 */
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
    { upsert: true, returnDocument: "after" },
  );
};

// ---------------------------------------------------------------------------
// CONTROLLER FUNCTIONS
// ---------------------------------------------------------------------------

// @description  Bulk mark attendance for multiple employees on a single date
// @route        POST /api/attendances/bulk-mark
// @access       Admin
export const bulkMarkAttendance = async (req, res, next) => {
  try {
    const {
      employeeIds,
      date,
      fallbackShiftId,
      forceApplyShift,
      overwrite,
      markAllDaysPresent,
    } = req.body;

    // --- Validate required fields ---
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400);
      throw new Error("At least one employee ID is required");
    }

    if (!date) {
      res.status(400);
      throw new Error("Attendance date is required");
    }

    if (Array.isArray(req.body.dateRanges) && req.body.dateRanges.length > 0) {
      res.status(400);
      throw new Error(
        "Date ranges are no longer supported. Please select a single attendance date.",
      );
    }

    const attendanceDate = normalizeUtcDate(date);
    if (!attendanceDate) {
      res.status(400);
      throw new Error("Invalid attendance date");
    }

    // --- Validate employee IDs ---
    const invalidEmpIds = employeeIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidEmpIds.length > 0) {
      res.status(400);
      throw new Error(`Invalid employee ID(s): ${invalidEmpIds.join(", ")}`);
    }

    // --- Validate fallback shift if provided ---
    let fallbackShift = null;
    if (fallbackShiftId) {
      if (!mongoose.Types.ObjectId.isValid(fallbackShiftId)) {
        res.status(400);
        throw new Error("Invalid fallback shift ID");
      }
      fallbackShift = await Shift.findById(fallbackShiftId);
      if (!fallbackShift) {
        res.status(404);
        throw new Error("Fallback shift not found");
      }
    }

    // --- Validate force shift if forceApplyShift is true and fallbackShiftId provided ---
    let forceShift = null;
    if (forceApplyShift) {
      if (!fallbackShiftId) {
        res.status(400);
        throw new Error(
          "A shift must be selected when Force Apply Shift is enabled",
        );
      }
      forceShift = fallbackShift;
    }

    // --- Check all employees exist ---
    const employees = await Employee.find({ _id: { $in: employeeIds } }).select(
      "_id fullName employeeID joiningDate resignationDate",
    );
    if (employees.length !== employeeIds.length) {
      const foundIds = employees.map((e) => e._id.toString());
      const notFoundIds = employeeIds.filter((id) => !foundIds.includes(id));
      res.status(404);
      throw new Error(`Employee(s) not found: ${notFoundIds.join(", ")}`);
    }

    // Build joining date map
    const employmentBoundsMap = {};
    for (const emp of employees) {
      employmentBoundsMap[emp._id.toString()] = getEmploymentBounds(emp);
    }

    const allDates = [attendanceDate];

    // --- Fetch all current active shifts for all employees in one query ---
    const activeShifts = await EmployeeShift.find({
      employee: { $in: employeeIds },
      endDate: null,
    }).populate("shift");

    const employeeShiftMap = {};
    for (const es of activeShifts) {
      employeeShiftMap[es.employee.toString()] = es.shift;
    }

    // --- Process each employee × date ---
    let created = 0;
    let skipped = 0;
    const errors = [];

    // Track which employee-months need summary refresh
    const monthsToRefresh = new Set();

    const earliestDate = attendanceDate;

    for (const employeeId of employeeIds) {
      // Determine the shift to use for this employee
      let shiftToUse = null;
      let usedFallbackOrForce = false;

      if (forceApplyShift && forceShift) {
        // Force apply: always use the modal shift
        shiftToUse = forceShift;
        // If this employee had no assignment, flag for auto-creation
        if (!employeeShiftMap[employeeId]) {
          usedFallbackOrForce = true;
        }
      } else {
        // Use employee's assigned shift first
        shiftToUse = employeeShiftMap[employeeId] || null;
        // Fall back to fallback shift if no assigned shift
        if (!shiftToUse && fallbackShift) {
          shiftToUse = fallbackShift;
          usedFallbackOrForce = true;
        }
        // If still no shift, record error and skip this employee
        if (!shiftToUse) {
          errors.push({
            employeeId,
            error:
              "No assigned shift found and no fallback shift selected. Please assign a shift or select a fallback shift.",
          });
          continue;
        }
      }

      // Auto-create EmployeeShift assignment when fallback/force shift is used
      // and the employee has no existing shift assignment, so that payroll and
      // other modules can correctly determine working days.
      if (usedFallbackOrForce) {
        try {
          await EmployeeShift.create({
            employee: employeeId,
            shift: shiftToUse._id,
            effectiveDate: earliestDate,
            endDate: null,
            assignedBy: req.user._id,
          });
          // Update the in-memory map so subsequent logic sees it
          employeeShiftMap[employeeId] = shiftToUse;
        } catch (shiftErr) {
          // If duplicate or other error, log but don't block attendance marking
          if (shiftErr.code !== 11000) {
            errors.push({
              employeeId,
              error: `Shift auto-assignment failed: ${shiftErr.message}. Attendance will still be marked.`,
            });
          }
        }
      }

      for (const date of allDates) {
        const bounds = employmentBoundsMap[employeeId] || {};
        if (bounds.joiningDate && date < bounds.joiningDate) {
          const emp = employees.find((e) => e._id.toString() === employeeId);
          const label = emp ? `${emp.fullName} (${emp.employeeID})` : employeeId;
          errors.push({
            employeeId,
            date: date.toISOString().split("T")[0],
            error: `Date is before ${label}'s joining date (${bounds.joiningDate.toISOString().split("T")[0]})`,
          });
          continue;
        }

        if (bounds.resignationDate && date > bounds.resignationDate) {
          const emp = employees.find((e) => e._id.toString() === employeeId);
          const label = emp ? `${emp.fullName} (${emp.employeeID})` : employeeId;
          errors.push({
            employeeId,
            date: date.toISOString().split("T")[0],
            error: `Date is after ${label}'s resignation date (${bounds.resignationDate.toISOString().split("T")[0]})`,
          });
          continue;
        }
        try {
          // Determine status
          let status;
          if (markAllDaysPresent) {
            status = "Present";
          } else {
            const dayName = getDayName(date);
            const isWorkingDay = shiftToUse.workingDays.includes(dayName);
            status = isWorkingDay ? "Present" : "Off";
          }

          // Build checkIn / checkOut from shift times (null if status is Off or times are missing)
          let checkIn = status !== "Off" ? buildDateTimeFromShiftTime(date, shiftToUse.startTime) : null;
          let checkOut = status !== "Off" ? buildDateTimeFromShiftTime(date, shiftToUse.endTime) : null;

          if (TIMED_STATUSES.includes(status)) {
            ({ checkIn, checkOut } = ensureCheckTimesForTimedStatus({
              status,
              date,
              shift: shiftToUse,
              checkIn,
              checkOut,
            }));
          }

          const existing = await Attendance.findOne({
            employee: employeeId,
            date,
          });

          if (existing && isApprovedLeaveLockedRecord(existing)) {
            skipped++;
            errors.push({
              employeeId,
              date: date.toISOString().split("T")[0],
              error:
                "Attendance is locked by an approved leave application and cannot be overwritten.",
            });
            continue;
          }

          // Handle overwrite logic
          if (overwrite) {
            // Upsert — replace existing or create new
            await Attendance.findOneAndUpdate(
              { employee: employeeId, date },
              {
                employee: employeeId,
                date,
                status,
                shift: shiftToUse._id,
                checkIn,
                checkOut,
                lateDurationMinutes: 0,
                workHours: null,
                source: "manual",
                lockReason: null,
                linkedLeaveApplication: null,
                markedBy: req.user._id,
              },
              { upsert: true, returnDocument: "after" },
            );
          } else {
            // Skip if record exists
            if (existing) {
              skipped++;
              continue;
            }
            await Attendance.create({
              employee: employeeId,
              date,
              status,
              shift: shiftToUse._id,
              checkIn,
              checkOut,
              lateDurationMinutes: 0,
              workHours: null,
              source: "manual",
              lockReason: null,
              linkedLeaveApplication: null,
              markedBy: req.user._id,
            });
          }

          created++;
          // Track month for summary refresh
          monthsToRefresh.add(
            `${employeeId}__${date.getUTCFullYear()}__${date.getUTCMonth()}`,
          );
        } catch (err) {
          if (err.code === 11000) {
            // Duplicate key — record already exists, count as skipped
            skipped++;
          } else {
            errors.push({
              employeeId,
              date: date.toISOString().split("T")[0],
              error: err.message,
            });
          }
        }
      }
    }

    // Refresh monthly summaries for all affected employee-months
    const refreshPromises = [];
    for (const key of monthsToRefresh) {
      const [empId, year, month] = key.split("__");
      refreshPromises.push(
        refreshMonthlySummary(empId, Number(year), Number(month)),
      );
    }
    await Promise.all(refreshPromises);

    res.status(201).json({
      message: `Attendance marked: ${created} record(s) created, ${skipped} skipped.`,
      created,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    next(err);
  }
};

// @description  Get monthly attendance grid (for AttendanceRecords page)
// @route        GET /api/attendances/monthly
// @access       Admin, Supervisor
export const getMonthlyAttendance = async (req, res, next) => {
  try {
    const {
      year,
      month, // 0-indexed
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    if (year === undefined || month === undefined) {
      res.status(400);
      throw new Error("year and month are required");
    }

    const y = Number(year);
    const m = Number(month);

    const startOfMonth = new Date(Date.UTC(y, m, 1));
    const endOfMonth = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

    // Build employee filter
    const employeeFilter = { status: { $in: ["Active", "Resigned"] } };
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      employeeFilter.$or = [{ fullName: regex }, { employeeID: regex }];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Get employees (paginated)
    let employeeQuery = Employee.find(employeeFilter)
      .select("_id fullName employeeID joiningDate resignationDate")
      .sort({ fullName: 1 });

    const totalItems = await Employee.countDocuments(employeeFilter);

    if (limitNum > 0) {
      employeeQuery = employeeQuery
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);
    }

    const employees = await employeeQuery;

    if (employees.length === 0) {
      return res.json({
        employees: [],
        pagination: {
          currentPage: pageNum,
          totalPages: limitNum > 0 ? Math.ceil(totalItems / limitNum) : 1,
          totalItems,
          limit: limitNum,
        },
      });
    }

    const employeeIds = employees.map((e) => e._id);

    // Fetch only shift assignments that overlap the viewed month:
    //   effectiveDate <= endOfMonth  AND  (endDate is null OR endDate >= startOfMonth)
    const allShiftAssignments = await EmployeeShift.find({
      employee: { $in: employeeIds },
      effectiveDate: { $lte: endOfMonth },
      $or: [{ endDate: null }, { endDate: { $gte: startOfMonth } }],
    }).populate("shift", "workingDays name").sort({ effectiveDate: 1 });

    // Build history map: empId -> assignments sorted by effectiveDate ASC
    const shiftHistoryMap = {};
    for (const es of allShiftAssignments) {
      const empKey = es.employee.toString();
      if (!shiftHistoryMap[empKey]) shiftHistoryMap[empKey] = [];
      shiftHistoryMap[empKey].push(es);
    }

    // Current active shift working days (for header/cell off-day highlighting in frontend)
    const employeeShiftWorkingDaysMap = {};
    for (const es of allShiftAssignments) {
      if (!es.endDate && es.shift?.workingDays) {
        // Sorted ascending — last endDate:null assignment per employee is the current one
        employeeShiftWorkingDaysMap[es.employee.toString()] = es.shift.workingDays;
      }
    }

    // Fetch all attendance records for these employees in the month
    const records = await Attendance.find({
      employee: { $in: employeeIds },
      date: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .select("employee date status shift checkIn checkOut lateDurationMinutes source lockReason linkedLeaveApplication")
      .lean();

    const linkedLeaveIds = [
      ...new Set(
        records
          .map((r) => r.linkedLeaveApplication?.toString())
          .filter(Boolean),
      ),
    ];

    let leaveMetaMap = {};
    if (linkedLeaveIds.length > 0) {
      const linkedLeaves = await LeaveApplication.find({
        _id: { $in: linkedLeaveIds },
      })
        .populate("leaveType", "name isPaid")
        .select("_id leaveType")
        .lean();

      leaveMetaMap = linkedLeaves.reduce((acc, leave) => {
        acc[leave._id.toString()] = {
          leaveTypeName: leave.leaveType?.name || null,
          leaveIsPaid:
            typeof leave.leaveType?.isPaid === "boolean"
              ? leave.leaveType.isPaid
              : null,
        };
        return acc;
      }, {});
    }

    // Build a lookup map: employeeId -> day -> record
    const recordMap = {};
    for (const rec of records) {
      const empKey = rec.employee.toString();
      const day = new Date(rec.date).getUTCDate();
      const linkedLeaveId = rec.linkedLeaveApplication?.toString() || null;
      const leaveMeta = linkedLeaveId ? leaveMetaMap[linkedLeaveId] : null;
      if (!recordMap[empKey]) recordMap[empKey] = {};
      recordMap[empKey][day] = {
        _id: rec._id,
        status: rec.status,
        shift: rec.shift,
        checkIn: rec.checkIn,
        checkOut: rec.checkOut,
        lateDurationMinutes: rec.lateDurationMinutes || 0,
        source: rec.source,
        lockReason: rec.lockReason || null,
        linkedLeaveApplication: rec.linkedLeaveApplication || null,
        isLocked: isApprovedLeaveLockedRecord(rec),
        leaveTypeName: leaveMeta?.leaveTypeName || null,
        leaveIsPaid: leaveMeta?.leaveIsPaid ?? null,
      };
    }

    // Build result array
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    const result = employees.map((emp) => {
      const empRecords = recordMap[emp._id.toString()] || {};
      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
      );

      const { joiningDate, resignationDate } = getEmploymentBounds(emp);

      const empShiftHistory = shiftHistoryMap[emp._id.toString()] || [];
      const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      const records = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateUTC = new Date(Date.UTC(y, m, d));
        if (joiningDate && dateUTC < joiningDate) {
          records[d] = null;
        } else if (resignationDate && dateUTC > resignationDate) {
          records[d] = null;
        } else if (empRecords[d]) {
          records[d] = empRecords[d]; // Always show existing record, even for future dates
        } else if (dateUTC > todayUTC) {
          records[d] = null; // Future date with no record
        } else {
          // Past/today with no record — infer from shift history on that specific date
          const workingDays = getWorkingDaysForDate(empShiftHistory, dateUTC);
          if (workingDays) {
            const dayName = DAY_NAMES[dateUTC.getUTCDay()];
            if (!workingDays.includes(dayName)) {
              records[d] = { status: "Off", _inferred: true }; // synthetic off-day (no DB record)
            } else {
              records[d] = undefined; // working day with no record marked yet
            }
          } else {
            records[d] = undefined; // no shift assigned on this date
          }
        }
      }

      // Summary counts — iterate all non-future days so shift-based off days are counted
      // even when no attendance record exists for that day
      const summary = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        off: 0,
        leave: 0,
        paidLeave: 0,
        unpaidLeave: 0,
        workingDays: 0,
      };

      for (let d = 1; d <= daysInMonth; d++) {
        const dateUTC = new Date(Date.UTC(y, m, d));
        if (joiningDate && dateUTC < joiningDate) continue;
        if (resignationDate && dateUTC > resignationDate) continue;

        const workingDays = getWorkingDaysForDate(empShiftHistory, dateUTC);
        const dayName = DAY_NAMES[dateUTC.getUTCDay()];
        const isScheduledWorkingDay =
          Array.isArray(workingDays) && workingDays.includes(dayName);

        const rec = empRecords[d];
        if (rec) {
          switch (rec.status) {
            case "Present":   summary.present++;  break;
            case "Absent":    summary.absent++;   break;
            case "Late":      summary.late++;     break;
            case "Half Day":  summary.halfDay++;  break;
            case "Off":       summary.off++;      break;
            case "Leave":
              summary.leave++;
              if (rec.leaveIsPaid === true) summary.paidLeave++;
              if (rec.leaveIsPaid === false) summary.unpaidLeave++;
              break;
          }
          if (dateUTC <= todayUTC && isScheduledWorkingDay) {
            summary.workingDays++;
          }
          continue;
        }

        if (dateUTC > todayUTC) {
          continue; // future day with no record
        } else {
          // No DB record — infer off day from shift active on that specific date
          if (workingDays) {
            if (!workingDays.includes(dayName)) {
              summary.off++;
            } else {
              summary.workingDays++;
            }
          }
        }
      }

      return {
        employee: {
          _id: emp._id,
          fullName: emp.fullName,
          employeeID: emp.employeeID,
        },
        shiftWorkingDays: employeeShiftWorkingDaysMap[emp._id.toString()] || null,
        records,
        summary,
      };
    });

    const totalPages = limitNum > 0 ? Math.ceil(totalItems / limitNum) : 1;

    res.json({
      employees: result,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems,
        limit: limitNum,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @description  Get single employee's attendance for a month (for cell edit modal)
// @route        GET /api/attendances/employee/:id
// @access       Admin, Supervisor
export const getEmployeeMonthlyAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const y = Number(year);
    const m = Number(month);

    const startOfMonth = new Date(Date.UTC(y, m, 1));
    const endOfMonth = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

    const records = await Attendance.find({
      employee: id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .populate("shift", "name startTime endTime workingDays")
      .sort({ date: 1 });

    res.json({ records });
  } catch (err) {
    next(err);
  }
};

// @description  Update a single attendance record (cell edit)
// @route        PUT /api/attendances/:id
// @access       Admin
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid attendance ID");
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      res.status(404);
      throw new Error("Attendance record not found");
    }

    const employee = await Employee.findById(attendance.employee).select(
      "joiningDate resignationDate",
    );
    const employmentBoundaryError = getEmploymentBoundaryError(
      normalizeUtcDate(attendance.date),
      employee,
    );
    if (employmentBoundaryError) {
      res.status(400);
      throw new Error(employmentBoundaryError);
    }

    if (isApprovedLeaveLockedRecord(attendance)) {
      res.status(403);
      throw new Error(
        "This attendance record is auto-managed by an approved leave application and cannot be edited.",
      );
    }

    const { status, shiftId, checkIn, checkOut, lateDurationMinutes } =
      req.body;

    const allowedStatuses = [
      "Present",
      "Absent",
      "Late",
      "Half Day",
      "Off",
      "Leave",
    ];
    if (status && !allowedStatuses.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`);
    }

    if (shiftId && !mongoose.Types.ObjectId.isValid(shiftId)) {
      res.status(400);
      throw new Error("Invalid shift ID");
    }

    // shiftId explicitly set to null/empty means caller tried to clear the shift — reject
    if (shiftId !== undefined && !shiftId) {
      res.status(400);
      throw new Error("shiftId is required and cannot be cleared");
    }

    if (status) attendance.status = status;
    if (shiftId) attendance.shift = shiftId;
    if (checkIn !== undefined)
      attendance.checkIn = checkIn ? safeDateParse(checkIn) : null;
    if (checkOut !== undefined)
      attendance.checkOut = checkOut ? safeDateParse(checkOut) : null;
    if (lateDurationMinutes !== undefined)
      attendance.lateDurationMinutes = lateDurationMinutes;

    let shiftForRules = null;
    if (attendance.shift) {
      shiftForRules = await Shift.findById(attendance.shift).select(
        "startTime endTime",
      );
    }

    attendance.status = computeStatusFromCheckTimes({
      requestedStatus: attendance.status,
      shift: shiftForRules,
      date: attendance.date,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
    });

    if (TIMED_STATUSES.includes(attendance.status)) {
      const ensuredTimes = ensureCheckTimesForTimedStatus({
        status: attendance.status,
        date: attendance.date,
        shift: shiftForRules,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
      });
      attendance.checkIn = ensuredTimes.checkIn;
      attendance.checkOut = ensuredTimes.checkOut;
    }

    const computedLateMinutes = computeLateMinutesFromCheckIn({
      shift: shiftForRules,
      date: attendance.date,
      checkIn: attendance.checkIn,
    });

    attendance.lateDurationMinutes = computedLateMinutes;

    attendance.markedBy = req.user._id;
    attendance.source = "manual";

    await attendance.save();

    // Refresh monthly summary
    const date = new Date(attendance.date);
    await refreshMonthlySummary(
      attendance.employee.toString(),
      date.getUTCFullYear(),
      date.getUTCMonth(),
    );

    const updated = await Attendance.findById(id).populate(
      "shift",
      "name startTime endTime workingDays",
    );

    res.json({
      message: "Attendance updated successfully",
      attendance: updated,
    });
  } catch (err) {
    next(err);
  }
};

// @description  Create a single attendance record (cell edit for empty cell)
// @route        POST /api/attendances/mark-single
// @access       Admin
export const markSingleAttendance = async (req, res, next) => {
  try {
    const { employeeId, date, status, shiftId, checkIn, checkOut, lateDurationMinutes } =
      req.body;

    if (!employeeId || !date || !status) {
      res.status(400);
      throw new Error("employeeId, date, and status are required");
    }

    if (!shiftId) {
      res.status(400);
      throw new Error("shiftId is required");
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const allowedStatuses = [
      "Present",
      "Absent",
      "Late",
      "Half Day",
      "Off",
      "Leave",
    ];
    if (!allowedStatuses.includes(status)) {
      res.status(400);
      throw new Error(`Invalid status. Allowed: ${allowedStatuses.join(", ")}`);
    }

    const parsedDate = new Date(date);
    parsedDate.setUTCHours(0, 0, 0, 0);

    const leaveExists = await hasApprovedLeaveOnDate(employeeId, parsedDate);
    if (leaveExists && status !== "Leave") {
      res.status(400);
      throw new Error(
        "Approved leave exists for this date. Non-leave attendance cannot be created.",
      );
    }

    // Check employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const employmentBoundaryError = getEmploymentBoundaryError(
      parsedDate,
      employee,
    );
    if (employmentBoundaryError) {
      res.status(400);
      throw new Error(employmentBoundaryError);
    }

    // Check for existing record
    const existing = await Attendance.findOne({
      employee: employeeId,
      date: parsedDate,
    });
    if (existing) {
      res.status(400);
      throw new Error(
        "Attendance record already exists for this date. Use PUT to update.",
      );
    }

    let resolvedShiftId = null;
    let resolvedShift = null;
    let resolvedCheckIn = null;
    let resolvedCheckOut = null;

    if (shiftId) {
      if (!mongoose.Types.ObjectId.isValid(shiftId)) {
        res.status(400);
        throw new Error("Invalid shift ID");
      }
      const shift = await Shift.findById(shiftId);
      if (!shift) {
        res.status(404);
        throw new Error("Shift not found");
      }
      resolvedShiftId = shift._id;
      resolvedShift = shift;

      // Auto-fill checkIn/checkOut from shift if not provided
      resolvedCheckIn = checkIn
        ? safeDateParse(checkIn)
        : buildDateTimeFromShiftTime(parsedDate, shift.startTime);
      resolvedCheckOut = checkOut
        ? safeDateParse(checkOut)
        : buildDateTimeFromShiftTime(parsedDate, shift.endTime);
    } else {
      if (checkIn) resolvedCheckIn = safeDateParse(checkIn);
      if (checkOut) resolvedCheckOut = safeDateParse(checkOut);
    }

    const computedStatus = computeStatusFromCheckTimes({
      requestedStatus: status,
      shift: resolvedShift,
      date: parsedDate,
      checkIn: resolvedCheckIn,
      checkOut: resolvedCheckOut,
    });

    if (TIMED_STATUSES.includes(computedStatus)) {
      const ensuredTimes = ensureCheckTimesForTimedStatus({
        status: computedStatus,
        date: parsedDate,
        shift: resolvedShift,
        checkIn: resolvedCheckIn,
        checkOut: resolvedCheckOut,
      });
      resolvedCheckIn = ensuredTimes.checkIn;
      resolvedCheckOut = ensuredTimes.checkOut;
    }

    const computedLateMinutes = computeLateMinutesFromCheckIn({
      shift: resolvedShift,
      date: parsedDate,
      checkIn: resolvedCheckIn,
    });

    const attendance = await Attendance.create({
      employee: employeeId,
      date: parsedDate,
      status: computedStatus,
      shift: resolvedShiftId,
      checkIn: resolvedCheckIn,
      checkOut: resolvedCheckOut,
      lateDurationMinutes: computedLateMinutes,
      workHours: null,
      source: "manual",
      lockReason: null,
      linkedLeaveApplication: null,
      markedBy: req.user._id,
    });

    // Refresh monthly summary
    await refreshMonthlySummary(
      employeeId,
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
    );

    const created = await Attendance.findById(attendance._id).populate(
      "shift",
      "name startTime endTime workingDays",
    );

    res.status(201).json({
      message: "Attendance record created successfully",
      attendance: created,
    });
  } catch (err) {
    next(err);
  }
};

// @description  Delete a single attendance record
// @route        DELETE /api/attendances/:id
// @access       Admin
export const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid attendance ID");
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      res.status(404);
      throw new Error("Attendance record not found");
    }

    if (isApprovedLeaveLockedRecord(attendance)) {
      res.status(403);
      throw new Error(
        "This attendance record is auto-managed by an approved leave application and cannot be deleted.",
      );
    }

    const date = new Date(attendance.date);
    const employeeId = attendance.employee.toString();

    await Attendance.findByIdAndDelete(id);

    // Refresh monthly summary
    await refreshMonthlySummary(
      employeeId,
      date.getUTCFullYear(),
      date.getUTCMonth(),
    );

    res.json({ message: "Attendance record deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// @description  Get monthly summary for a single employee (for payroll)
// @route        GET /api/attendances/summary/:employeeId
// @access       Admin
export const getEmployeeMonthlySummary = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const summary = await MonthlyAttendanceSummary.findOne({
      employee: employeeId,
      year: Number(year),
      month: Number(month),
    });

    res.json({
      summary: summary || {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        off: 0,
        leave: 0,
        totalWorkingDays: 0,
      },
    });
  } catch (err) {
    next(err);
  }
};
