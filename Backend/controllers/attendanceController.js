import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import MonthlyAttendanceSummary from "../models/MonthlyAttendanceSummary.js";
import Employee from "../models/Employee.js";
import EmployeeShift from "../models/EmployeeShift.js";
import Shift from "../models/Shift.js";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Expand an array of { startDate, endDate } into individual Date objects (UTC midnight).
 */
const expandDateRanges = (dateRanges) => {
  const dates = [];
  for (const range of dateRanges) {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    const current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  return dates;
};

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
 */
const buildDateTimeFromShiftTime = (date, timeStr) => {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const dt = new Date(date);
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
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
    { upsert: true, new: true },
  );
};

// ---------------------------------------------------------------------------
// CONTROLLER FUNCTIONS
// ---------------------------------------------------------------------------

// @description  Bulk mark attendance for multiple employees over date ranges
// @route        POST /api/attendances/bulk-mark
// @access       Admin
export const bulkMarkAttendance = async (req, res, next) => {
  try {
    const {
      employeeIds,
      dateRanges,
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

    if (!dateRanges || !Array.isArray(dateRanges) || dateRanges.length === 0) {
      res.status(400);
      throw new Error("At least one date range is required");
    }

    for (const range of dateRanges) {
      if (!range.startDate || !range.endDate) {
        res.status(400);
        throw new Error("Each date range must have startDate and endDate");
      }
      if (new Date(range.endDate) < new Date(range.startDate)) {
        res.status(400);
        throw new Error("endDate cannot be before startDate in a date range");
      }
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
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    if (employees.length !== employeeIds.length) {
      const foundIds = employees.map((e) => e._id.toString());
      const notFoundIds = employeeIds.filter((id) => !foundIds.includes(id));
      res.status(404);
      throw new Error(`Employee(s) not found: ${notFoundIds.join(", ")}`);
    }

    // --- Expand date ranges into individual dates ---
    const allDates = expandDateRanges(dateRanges);
    if (allDates.length === 0) {
      res.status(400);
      throw new Error("No valid dates found in date ranges");
    }

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

    for (const employeeId of employeeIds) {
      // Determine the shift to use for this employee
      let shiftToUse = null;

      if (forceApplyShift && forceShift) {
        // Force apply: always use the modal shift
        shiftToUse = forceShift;
      } else {
        // Use employee's assigned shift first
        shiftToUse = employeeShiftMap[employeeId] || null;
        // Fall back to fallback shift if no assigned shift
        if (!shiftToUse && fallbackShift) {
          shiftToUse = fallbackShift;
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

      for (const date of allDates) {
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

          // Build checkIn / checkOut from shift times
          const checkIn = buildDateTimeFromShiftTime(date, shiftToUse.startTime);
          const checkOut = buildDateTimeFromShiftTime(date, shiftToUse.endTime);

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
                markedBy: req.user._id,
              },
              { upsert: true, new: true },
            );
          } else {
            // Skip if record exists
            const existing = await Attendance.findOne({
              employee: employeeId,
              date,
            });
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
    const employeeFilter = { status: "Active" };
    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      employeeFilter.$or = [{ fullName: regex }, { employeeID: regex }];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Get employees (paginated)
    let employeeQuery = Employee.find(employeeFilter)
      .select("_id fullName employeeID")
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

    // Fetch active shifts for all employees to determine off days
    const activeShifts = await EmployeeShift.find({
      employee: { $in: employeeIds },
      endDate: null,
    }).populate("shift", "workingDays name");

    const employeeShiftWorkingDaysMap = {};
    for (const es of activeShifts) {
      if (es.shift?.workingDays) {
        employeeShiftWorkingDaysMap[es.employee.toString()] = es.shift.workingDays;
      }
    }

    // Fetch all attendance records for these employees in the month
    const records = await Attendance.find({
      employee: { $in: employeeIds },
      date: { $gte: startOfMonth, $lte: endOfMonth },
    })
      .select("employee date status shift checkIn checkOut lateDurationMinutes")
      .lean();

    // Build a lookup map: employeeId -> day -> record
    const recordMap = {};
    for (const rec of records) {
      const empKey = rec.employee.toString();
      const day = new Date(rec.date).getUTCDate();
      if (!recordMap[empKey]) recordMap[empKey] = {};
      recordMap[empKey][day] = {
        _id: rec._id,
        status: rec.status,
        shift: rec.shift,
        checkIn: rec.checkIn,
        checkOut: rec.checkOut,
        lateDurationMinutes: rec.lateDurationMinutes || 0,
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

      const records = {};
      for (let d = 1; d <= daysInMonth; d++) {
        const dateUTC = new Date(Date.UTC(y, m, d));
        if (empRecords[d]) {
          records[d] = empRecords[d]; // Always show existing record, even for future dates
        } else if (dateUTC > todayUTC) {
          records[d] = null; // Future date with no record
        } else {
          records[d] = undefined; // Past/today with no record
        }
      }

      // Summary counts
      const summary = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        off: 0,
        leave: 0,
      };

      for (const rec of Object.values(empRecords)) {
        if (!rec) continue;
        switch (rec.status) {
          case "Present":
            summary.present++;
            break;
          case "Absent":
            summary.absent++;
            break;
          case "Late":
            summary.late++;
            break;
          case "Half Day":
            summary.halfDay++;
            break;
          case "Off":
            summary.off++;
            break;
          case "Leave":
            summary.leave++;
            break;
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

    if (status) attendance.status = status;
    if (shiftId !== undefined) attendance.shift = shiftId || null;
    if (checkIn !== undefined)
      attendance.checkIn = checkIn ? new Date(checkIn) : null;
    if (checkOut !== undefined)
      attendance.checkOut = checkOut ? new Date(checkOut) : null;
    if (lateDurationMinutes !== undefined)
      attendance.lateDurationMinutes = lateDurationMinutes;
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

    // Check employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
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

      // Auto-fill checkIn/checkOut from shift if not provided
      resolvedCheckIn = checkIn
        ? new Date(checkIn)
        : buildDateTimeFromShiftTime(parsedDate, shift.startTime);
      resolvedCheckOut = checkOut
        ? new Date(checkOut)
        : buildDateTimeFromShiftTime(parsedDate, shift.endTime);
    } else {
      if (checkIn) resolvedCheckIn = new Date(checkIn);
      if (checkOut) resolvedCheckOut = new Date(checkOut);
    }

    const attendance = await Attendance.create({
      employee: employeeId,
      date: parsedDate,
      status,
      shift: resolvedShiftId,
      checkIn: resolvedCheckIn,
      checkOut: resolvedCheckOut,
      lateDurationMinutes: lateDurationMinutes || 0,
      workHours: null,
      source: "manual",
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
