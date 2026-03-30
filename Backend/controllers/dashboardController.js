import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import Attendance from "../models/Attendance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Contract from "../models/Contract.js";
import Payroll from "../models/Payroll.js";
import DisciplinaryAction from "../models/DisciplinaryAction.js";
import WorkProgressReport from "../models/WorkProgressReport.js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  PAKISTAN_TZ,
  getCurrentPKYearMonth,
  getMonthStartEndUtcForPakistan,
} from "../utils/timezone.js";

const PERIOD_TYPES = new Set(["monthly", "quarterly", "yearly"]);
const CLOSED_PROGRESS_STATUSES = [
  "Completed (Early)",
  "Completed (On Time)",
  "Completed (Late)",
  "Closed (Early)",
  "Closed (On Time)",
  "Closed (Late)",
  "Closed",
];
const ATTENDANCE_STATUS_FIELDS = [
  { field: "present", status: "Present" },
  { field: "late", status: "Late" },
  { field: "absent", status: "Absent" },
  { field: "leave", status: "Leave" },
  { field: "halfDay", status: "Half Day" },
  { field: "off", status: "Off" },
];
const PROGRESS_STATUS_ORDER = ["Pending", "In Progress", "Completed", "Closed"];
const PROGRESS_STATUS_BUCKETS = {
  Pending: ["Pending"],
  "In Progress": ["In Progress"],
  Completed: [
    "Completed",
    "Completed (Early)",
    "Completed (On Time)",
    "Completed (Late)",
  ],
  Closed: [
    "Closed",
    "Closed (Early)",
    "Closed (On Time)",
    "Closed (Late)",
  ],
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const pad2 = (value) => String(value).padStart(2, "0");

const getQuarterMonths = (quarter) => {
  const normalizedQuarter = Math.min(Math.max(quarter, 1), 4);
  const startMonth = (normalizedQuarter - 1) * 3;
  return [startMonth, startMonth + 1, startMonth + 2];
};

const getPeriodMonthValues = ({ periodType, month, quarter }) => {
  if (periodType === "monthly") return [month];
  if (periodType === "quarterly") {
    return getQuarterMonths(quarter).map((monthIndex) => monthIndex + 1);
  }
  return Array.from({ length: 12 }, (_, index) => index + 1);
};

const getMonthLabel = (month) => MONTH_LABELS[Number(month) - 1] || String(month);

const createPakistanMidnightUtc = (year, month, day) =>
  fromZonedTime(`${year}-${pad2(month)}-${pad2(day)}T00:00:00`, PAKISTAN_TZ);

const addUtcDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const getWeekOptions = (year, month) => {
  const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
  const firstDayWeekday = firstDayOfMonth.getUTCDay();
  const daysFromMonday = (firstDayWeekday + 6) % 7;
  const firstWeekStart = new Date(firstDayOfMonth);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - daysFromMonday);

  const weeks = [];
  let weekStart = firstWeekStart;
  let weekNumber = 1;

  while (weekStart <= lastDayOfMonth) {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weeks.push({
      value: weekNumber,
      startDate: new Date(weekStart),
      endDate: weekEnd,
    });
    weekStart = addUtcDays(weekStart, 7);
    weekNumber += 1;
  }

  return weeks;
};

const getPeriodContext = (query) => {
  const { year: currentYear, month: currentMonth } = getCurrentPKYearMonth();
  const periodType = PERIOD_TYPES.has(query.periodType) ? query.periodType : "monthly";
  const year = safeNumber(query.year, currentYear);
  const month = Math.min(Math.max(safeNumber(query.month, currentMonth), 1), 12);
  const quarter = Math.min(Math.max(safeNumber(query.quarter, Math.ceil(month / 3)), 1), 4);

  let startDate;
  let endDate;
  let label = "";

  if (periodType === "yearly") {
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year + 1, 0, 1));
    label = `${year}`;
  } else if (periodType === "quarterly") {
    const months = getQuarterMonths(quarter);
    startDate = new Date(Date.UTC(year, months[0], 1));
    endDate = new Date(Date.UTC(year, months[2] + 1, 1));
    label = `Q${quarter} ${year}`;
  } else {
    startDate = new Date(Date.UTC(year, month - 1, 1));
    endDate = new Date(Date.UTC(year, month, 1));
    label = `${MONTH_LABELS[month - 1]} ${year}`;
  }

  return {
    periodType,
    year,
    month,
    quarter,
    startDate,
    endDate,
    label,
  };
};

const getAttendanceContext = (query, period) => {
  const allowedMonths = getPeriodMonthValues(period);
  const month = allowedMonths.includes(Number(query.attendanceMonth))
    ? Number(query.attendanceMonth)
    : allowedMonths[0];

  const year = period.year;
  const weekOptions = getWeekOptions(year, month);
  const defaultWeek = weekOptions[0]?.value || 1;
  const requestedWeek = safeNumber(query.attendanceWeek, defaultWeek);
  const selectedWeek =
    weekOptions.find((option) => option.value === requestedWeek) ||
    weekOptions[0];
  const weekStartDate = selectedWeek?.startDate || new Date(Date.UTC(year, month - 1, 1));
  const nextWeekStartDate = addUtcDays(weekStartDate, 7);

  return {
    viewType: "week",
    year,
    month,
    week: selectedWeek?.value || 1,
    startDate: createPakistanMidnightUtc(
      weekStartDate.getUTCFullYear(),
      weekStartDate.getUTCMonth() + 1,
      weekStartDate.getUTCDate(),
    ),
    endDate: createPakistanMidnightUtc(
      nextWeekStartDate.getUTCFullYear(),
      nextWeekStartDate.getUTCMonth() + 1,
      nextWeekStartDate.getUTCDate(),
    ),
    label: `${formatInTimeZone(weekStartDate, PAKISTAN_TZ, "dd MMM")} - ${formatInTimeZone(selectedWeek?.endDate || addUtcDays(weekStartDate, 6), PAKISTAN_TZ, "dd MMM yyyy")}`,
  };
};

const getPayrollContext = (query) => {
  const { year: currentYear } = getCurrentPKYearMonth();
  const year = safeNumber(query.payrollYear, currentYear);
  const months = Array.from({ length: 12 }, (_, index) => ({
    year,
    month: index + 1,
    label: MONTH_LABELS[index],
  }));

  return {
    year,
    months,
  };
};

const buildAttendanceDailySeries = (rawItems, attendanceContext) => {
  const attendanceMap = new Map();

  rawItems.forEach((entry) => {
    const dayKey = entry._id.day;
    const dayData = attendanceMap.get(dayKey) || {
      date: dayKey,
      label:
        attendanceContext.viewType === "week"
          ? formatInTimeZone(dayKey, PAKISTAN_TZ, "EEE")
          : formatInTimeZone(dayKey, PAKISTAN_TZ, "dd"),
      fullLabel: formatInTimeZone(dayKey, PAKISTAN_TZ, "dd MMM yyyy"),
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      halfDay: 0,
      off: 0,
    };

    const field = ATTENDANCE_STATUS_FIELDS.find(
      (item) => item.status === entry._id.status,
    )?.field;

    if (field) {
      dayData[field] = Number(entry.count || 0);
    }

    attendanceMap.set(dayKey, dayData);
  });

  const series = [];
  for (
    let cursor = new Date(attendanceContext.startDate);
    cursor < attendanceContext.endDate;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const dayKey = formatInTimeZone(cursor, PAKISTAN_TZ, "yyyy-MM-dd");
    const existing = attendanceMap.get(dayKey);

    series.push(
      existing || {
        date: dayKey,
        label:
          attendanceContext.viewType === "week"
            ? formatInTimeZone(cursor, PAKISTAN_TZ, "EEE")
            : formatInTimeZone(cursor, PAKISTAN_TZ, "dd"),
        fullLabel: formatInTimeZone(cursor, PAKISTAN_TZ, "dd MMM yyyy"),
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
        halfDay: 0,
        off: 0,
      },
    );
  }

  return series;
};

const buildSeveritySeries = (rawItems) =>
  ["Low", "Medium", "High"].map((key) => ({
    key,
    label: key,
    value: Number(rawItems.find((item) => item._id === key)?.count || 0),
  }));

const buildProgressSeries = (rawItems) => {
  const countMap = new Map(
    rawItems.map((item) => [item._id, Number(item.count || 0)]),
  );

  return PROGRESS_STATUS_ORDER.map((key) => ({
    key,
    label: key,
    value: (PROGRESS_STATUS_BUCKETS[key] || []).reduce(
      (sum, status) => sum + (countMap.get(status) || 0),
      0,
    ),
  }));
};

const getPeriodPayrollMonths = ({ periodType, month, quarter }) => {
  if (periodType === "yearly") {
    return Array.from({ length: 12 }, (_, index) => index + 1);
  }

  if (periodType === "quarterly") {
    return getQuarterMonths(quarter).map((monthIndex) => monthIndex + 1);
  }

  return [month];
};

const buildAttentionItems = ({
  pendingLeaves,
  overdueTasks,
  expiringContracts,
  payrollBlockedCount,
}) => {
  const items = [];

  pendingLeaves.forEach((leave) => {
    items.push({
      id: `leave-${leave._id}`,
      type: "leave",
      tone: "warning",
      title: leave.employee?.fullName || "Pending leave request",
      description: `${leave.leaveType?.name || "Leave"} awaiting approval`,
      date: leave.createdAt,
      href: "/leaves/applications",
    });
  });

  overdueTasks.forEach((task) => {
    items.push({
      id: `task-${task._id}`,
      type: "task",
      tone: "destructive",
      title: task.taskDescription,
      description: `Deadline passed for ${task.employees?.[0]?.fullName || "assigned employee"}`,
      date: task.deadline,
      href: "/compliance/work-progress-reports",
    });
  });

  expiringContracts.forEach((contract) => {
    items.push({
      id: `contract-${contract._id}`,
      type: "contract",
      tone: "default",
      title: contract.contractName,
      description: "Contract ending soon",
      date: contract.endDate,
      href: "/workforce/contracts",
    });
  });

  if (payrollBlockedCount > 0) {
    items.push({
      id: "payroll-blockers",
      type: "payroll",
      tone: "warning",
      title: `${payrollBlockedCount} employees pending payroll`,
      description: "Review this period's payroll coverage and blockers",
      href: "/salary/payroll",
      value: payrollBlockedCount,
    });
  }

  return items
    .sort((left, right) => {
      const leftTime = left.date ? new Date(left.date).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.date ? new Date(right.date).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, 8);
};

const buildUpcomingItems = ({ upcomingTasks, upcomingContracts, activeLeaves }) =>
  [
    ...upcomingTasks.map((task) => ({
      id: `due-task-${task._id}`,
      type: "task",
      title: task.taskDescription,
      subtitle: task.employees?.[0]?.fullName || "Assigned task",
      date: task.deadline,
      href: "/compliance/work-progress-reports",
    })),
    ...upcomingContracts.map((contract) => ({
      id: `due-contract-${contract._id}`,
      type: "contract",
      title: contract.contractName,
      subtitle: "Contract end date",
      date: contract.endDate,
      href: "/workforce/contracts",
    })),
    ...activeLeaves.map((leave) => ({
      id: `leave-end-${leave._id}`,
      type: "leave",
      title: leave.employee?.fullName || "Employee leave",
      subtitle: `${leave.leaveType?.name || "Leave"} ends`,
      date: leave.lastDate,
      href: "/leaves/applications",
    })),
  ]
    .sort((left, right) => new Date(left.date) - new Date(right.date))
    .slice(0, 8);

// @description     Get dashboard overview payload
// @route           GET /api/dashboard/overview
// @access          Admin, Supervisor
export const getDashboardOverview = async (req, res, next) => {
  try {
    const period = getPeriodContext(req.query);
    const attendanceContext = getAttendanceContext(req.query, period);
    const payrollContext = getPayrollContext(req.query);
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const soonCutoff = new Date(now);
    soonCutoff.setDate(soonCutoff.getDate() + 30);
    const upcomingCutoff = new Date(now);
    upcomingCutoff.setDate(upcomingCutoff.getDate() + 14);
    const payrollMonths = getPeriodPayrollMonths(period);

    const [
      activeEmployees,
      activeContracts,
      pendingLeaveCount,
      onLeaveToday,
      todayAttendanceRows,
      attendanceDailyRows,
      employmentMixRows,
      departmentHeadcountRows,
      payrollRows,
      activeDisciplinaryCount,
      severityRows,
      progressStatusRows,
      topPerformersRows,
      watchlistRows,
      pendingLeaves,
      overdueTasks,
      expiringContracts,
      upcomingTasks,
      upcomingContracts,
      activeLeaves,
      generatedPayrollCount,
    ] = await Promise.all([
      Employee.countDocuments({
        status: "Active",
        resignationDate: null,
      }),
      Contract.countDocuments({ status: "Active" }),
      LeaveApplication.countDocuments({ status: "Pending" }),
      LeaveApplication.countDocuments({
        status: "Approved",
        dates: {
          $elemMatch: {
            $gte: todayStart,
            $lt: todayEnd,
          },
        },
      }),
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: todayStart,
              $lt: todayEnd,
            },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      Attendance.aggregate([
        {
          $match: {
            date: {
              $gte: attendanceContext.startDate,
              $lt: attendanceContext.endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$date",
                  timezone: PAKISTAN_TZ,
                },
              },
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.day": 1,
          },
        },
      ]),
      Employee.aggregate([
        {
          $group: {
            _id: "$employmentType",
            count: { $sum: 1 },
          },
        },
      ]),
      Position.aggregate([
        {
          $lookup: {
            from: "departments",
            localField: "department",
            foreignField: "_id",
            as: "department",
          },
        },
        {
          $unwind: "$department",
        },
        {
          $lookup: {
            from: "employees",
            localField: "_id",
            foreignField: "position",
            as: "employees",
          },
        },
        {
          $project: {
            departmentName: "$department.name",
            employeeCount: { $size: "$employees" },
          },
        },
        {
          $group: {
            _id: "$departmentName",
            value: { $sum: "$employeeCount" },
          },
        },
        {
          $sort: {
            value: -1,
            _id: 1,
          },
        },
        {
          $limit: 6,
        },
      ]),
      Payroll.aggregate([
        {
          $match: {
            $or: payrollContext.months.map((entry) => ({
              year: entry.year,
              month: entry.month,
            })),
          },
        },
        {
          $group: {
            _id: { year: "$year", month: "$month" },
            gross: { $sum: "$calculations.grossSalary" },
            net: { $sum: "$calculations.netSalary" },
            deductions: { $sum: "$calculations.manualDeductionAmount" },
          },
        },
      ]),
      DisciplinaryAction.countDocuments({ status: "Active" }),
      DisciplinaryAction.aggregate([
        {
          $match: {
            status: "Active",
          },
        },
        {
          $lookup: {
            from: "warningtypes",
            localField: "warningType",
            foreignField: "_id",
            as: "warningType",
          },
        },
        { $unwind: "$warningType" },
        {
          $group: {
            _id: "$warningType.severity",
            count: { $sum: 1 },
          },
        },
      ]),
      WorkProgressReport.aggregate([
        {
          $match: {
            assignmentDate: {
              $gte: period.startDate,
              $lt: period.endDate,
            },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
      WorkProgressReport.aggregate([
        {
          $match: {
            assignmentDate: {
              $gte: period.startDate,
              $lt: period.endDate,
            },
            status: {
              $in: CLOSED_PROGRESS_STATUSES,
            },
            rating: {
              $ne: null,
            },
          },
        },
        { $unwind: "$employees" },
        {
          $lookup: {
            from: "employees",
            localField: "employees",
            foreignField: "_id",
            as: "employee",
          },
        },
        { $unwind: "$employee" },
        {
          $group: {
            _id: "$employee._id",
            employeeName: { $first: "$employee.fullName" },
            employeeID: { $first: "$employee.employeeID" },
            tasksCompleted: { $sum: 1 },
            averageRating: { $avg: "$rating" },
          },
        },
        {
          $sort: {
            averageRating: -1,
            tasksCompleted: -1,
          },
        },
        {
          $limit: 5,
        },
      ]),
      DisciplinaryAction.aggregate([
        {
          $match: {
            status: "Active",
          },
        },
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
          $group: {
            _id: "$employee._id",
            employeeName: { $first: "$employee.fullName" },
            employeeID: { $first: "$employee.employeeID" },
            activeActions: { $sum: 1 },
          },
        },
        {
          $sort: {
            activeActions: -1,
            employeeName: 1,
          },
        },
        {
          $limit: 5,
        },
      ]),
      LeaveApplication.find({ status: "Pending" })
        .sort({ createdAt: 1 })
        .limit(4)
        .populate("employee", "fullName employeeID")
        .populate("leaveType", "name"),
      WorkProgressReport.find({
        status: { $in: ["Pending", "In Progress"] },
        deadline: { $lt: now },
      })
        .sort({ deadline: 1 })
        .limit(4)
        .populate("employees", "fullName employeeID"),
      Contract.find({
        status: "Active",
        endDate: { $gte: now, $lte: soonCutoff },
      })
        .sort({ endDate: 1 })
        .limit(4)
        .select("contractName endDate"),
      WorkProgressReport.find({
        status: { $in: ["Pending", "In Progress"] },
        deadline: { $gte: now, $lte: upcomingCutoff },
      })
        .sort({ deadline: 1 })
        .limit(4)
        .populate("employees", "fullName employeeID"),
      Contract.find({
        status: "Active",
        endDate: { $gte: now, $lte: soonCutoff },
      })
        .sort({ endDate: 1 })
        .limit(4)
        .select("contractName endDate"),
      LeaveApplication.find({
        status: "Approved",
        dates: {
          $elemMatch: {
            $gte: now,
            $lte: soonCutoff,
          },
        },
      })
        .sort({ dates: 1 })
        .limit(4)
        .populate("employee", "fullName employeeID")
        .populate("leaveType", "name"),
      Payroll.countDocuments({
        year: period.year,
        month: {
          $in: payrollMonths,
        },
      }),
    ]);

    const attendanceDailySeries = buildAttendanceDailySeries(
      attendanceDailyRows,
      attendanceContext,
    );
    const todayAttendanceSummary = ATTENDANCE_STATUS_FIELDS.map((item) => ({
      key: item.field,
      label: item.status,
      value: Number(
        todayAttendanceRows.find((entry) => entry._id === item.status)?.count || 0,
      ),
    }));

    const employmentMix = [
      "Permanent",
      "Contract",
      "Part Time",
    ].map((key) => ({
      key,
      label: key,
      value: Number(employmentMixRows.find((item) => item._id === key)?.count || 0),
    }));

    const departmentHeadcount = departmentHeadcountRows.map((item) => ({
      key: item._id,
      label: item._id,
      value: Number(item.value || 0),
    }));

    const payrollMap = new Map(
      payrollRows.map((item) => [`${item._id.year}-${item._id.month}`, item]),
    );
    const payrollTrend = payrollContext.months.map((entry) => {
      const key = `${entry.year}-${entry.month}`;
      const item = payrollMap.get(key);
      return {
        ...entry,
        gross: Number(item?.gross || 0),
        net: Number(item?.net || 0),
        deductions: Number(item?.deductions || 0),
      };
    });

    const progressStatusCounts = buildProgressSeries(progressStatusRows);

    const topPerformers = topPerformersRows.map((item) => ({
      id: item._id,
      name: item.employeeName,
      employeeID: item.employeeID,
      tasksCompleted: Number(item.tasksCompleted || 0),
      averageRating: Number(item.averageRating || 0),
    }));

    const watchlist = watchlistRows.map((item) => ({
      id: item._id,
      name: item.employeeName,
      employeeID: item.employeeID,
      activeActions: Number(item.activeActions || 0),
    }));

    const payrollEligibleCount = activeEmployees * payrollMonths.length;
    const payrollBlockedCount = Math.max(payrollEligibleCount - generatedPayrollCount, 0);
    const activeLeavesWithLastDate = activeLeaves.map((leave) => ({
      ...leave.toObject(),
      lastDate: leave.dates?.length
        ? leave.dates
            .map((item) => new Date(item))
            .sort((left, right) => right - left)[0]
        : null,
    }));

    res.json({
      period: {
        periodType: period.periodType,
        year: period.year,
        month: period.month,
        quarter: period.quarter,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
      },
      overview: {
        workforce: {
          activeEmployees,
          onLeaveToday,
        },
        contracts: {
          activeContracts,
        },
        approvals: {
          pendingLeaves: pendingLeaveCount,
        },
        payroll: {
          generatedCount: generatedPayrollCount,
          eligibleCount: payrollEligibleCount,
          blockedCount: payrollBlockedCount,
        },
        compliance: {
          activeActions: activeDisciplinaryCount,
        },
      },
      analytics: {
        attendance: {
          viewType: attendanceContext.viewType,
          year: attendanceContext.year,
          month: attendanceContext.month,
          week: attendanceContext.week,
          label: attendanceContext.label,
          todayStatusCounts: todayAttendanceSummary,
          dailyBreakdown: attendanceDailySeries,
        },
        workforce: {
          employmentMix,
          departmentHeadcount,
        },
        payroll: {
          year: payrollContext.year,
          monthlyTotals: payrollTrend,
        },
        compliance: {
          activeActions: activeDisciplinaryCount,
          severityBreakdown: buildSeveritySeries(severityRows),
          watchlist,
        },
        progress: {
          statusCounts: progressStatusCounts,
          topPerformers,
        },
      },
      actionCenter: {
        items: buildAttentionItems({
          pendingLeaves,
          overdueTasks,
          expiringContracts,
          payrollBlockedCount,
        }),
        upcoming: buildUpcomingItems({
          upcomingTasks,
          upcomingContracts,
          activeLeaves: activeLeavesWithLastDate.filter((item) => item.lastDate),
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};
