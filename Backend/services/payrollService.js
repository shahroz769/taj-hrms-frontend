import Attendance from "../models/Attendance.js";
import Deduction from "../models/Deduction.js";
import Loan from "../models/Loan.js";
import EmployeeShift from "../models/EmployeeShift.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payroll from "../models/Payroll.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import BasicSalaryHistory from "../models/BasicSalaryHistory.js";
import EmployeeAllowanceHistory from "../models/EmployeeAllowanceHistory.js";
import {
  getMonthStartEndUtcForPakistan,
  PAKISTAN_TZ,
} from "../utils/timezone.js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  calculateAttendanceDeductionFromCounts,
  calculateManualDeductionPlan,
  calculateLoanDeductionForPayroll,
  getCalendarDaysInMonth,
} from "./payrollCalculationUtils.js";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const roundMoney = (value) => Math.round(Number(value) || 0);

export class PayrollGenerationError extends Error {
  constructor(message, reasonCode = "GENERATION_FAILED", statusCode = 400) {
    super(message);
    this.name = "PayrollGenerationError";
    this.reasonCode = reasonCode;
    this.statusCode = statusCode;
  }
}

const keyByPKDate = (date) => formatInTimeZone(date, PAKISTAN_TZ, "yyyy-MM-dd");

const normalizeUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pkDate = formatInTimeZone(date, PAKISTAN_TZ, "yyyy-MM-dd");
  return fromZonedTime(`${pkDate}T00:00:00`, PAKISTAN_TZ);
};

const isOutsideEmploymentWindow = (date, employmentBounds) => {
  if (employmentBounds.joiningDate && date < employmentBounds.joiningDate) {
    return true;
  }

  if (
    employmentBounds.resignationDate &&
    date > employmentBounds.resignationDate
  ) {
    return true;
  }

  return false;
};

const toMonthIndex = (year, month) => Number(year) * 12 + Number(month);

const isEarlierMonth = (yearA, monthA, yearB, monthB) =>
  toMonthIndex(yearA, monthA) < toMonthIndex(yearB, monthB);

const getAllDatesInRange = (start, endExclusive) => {
  const dates = [];
  const cursor = new Date(start);
  while (cursor < endExclusive) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const sumAllowances = (allowances = []) =>
  allowances
    .filter((item) => item.enabled)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

const getAllowanceBreakdown = (allowances = []) =>
  (allowances || [])
    .filter((item) => item.enabled && Number(item.amount || 0) > 0)
    .map((item) => ({
      name: item.allowanceComponent?.name || "Allowance",
      amount: Number(item.amount || 0),
    }));

const getSalaryFromHistory = (employee, salaryHistory, date) => {
  if (!salaryHistory?.length) return Number(employee.basicSalary || 0);

  const sorted = salaryHistory;
  const first = sorted[0];

  if (date < first.effectiveDate) {
    return Number(first.fromBasicSalary ?? employee.basicSalary ?? 0);
  }

  let value = Number(employee.basicSalary || 0);
  for (const entry of sorted) {
    if (entry.effectiveDate <= date) {
      value = Number(entry.toBasicSalary || 0);
    } else {
      break;
    }
  }
  return value;
};

const getAllowancesFromHistory = (employee, allowanceHistory, date) => {
  const fallback = employee.allowances || [];
  if (!allowanceHistory?.length) return fallback;

  const first = allowanceHistory[0];
  if (date < first.effectiveDate) {
    return first.fromAllowances || fallback;
  }

  let allowances = fallback;
  for (const entry of allowanceHistory) {
    if (entry.effectiveDate <= date) {
      allowances = entry.toAllowances || [];
    } else {
      break;
    }
  }

  return allowances;
};

const getShiftForDate = (assignments, date) => {
  for (let index = assignments.length - 1; index >= 0; index -= 1) {
    const assignment = assignments[index];
    if (
      assignment.effectiveDate <= date &&
      (!assignment.endDate || assignment.endDate >= date)
    ) {
      return assignment.shift || null;
    }
  }

  return null;
};

const getScheduledDatesForPayrollDivisor = async ({
  employeeId,
  monthStartUtc,
  nextMonthStartUtc,
}) => {
  const assignments = await EmployeeShift.find({
    employee: employeeId,
    effectiveDate: { $lt: nextMonthStartUtc },
    $or: [{ endDate: null }, { endDate: { $gte: monthStartUtc } }],
  })
    .populate("shift", "workingDays name")
    .sort({ effectiveDate: 1 });

  const monthDates = getAllDatesInRange(monthStartUtc, nextMonthStartUtc);
  const scheduledDates = [];

  const monthEndDate = new Date(nextMonthStartUtc.getTime() - 86400000);
  const monthStartShift = getShiftForDate(assignments, monthStartUtc);
  const monthEndShift = getShiftForDate(assignments, monthEndDate);
  const fallbackShift =
    monthEndShift ||
    monthStartShift ||
    assignments[assignments.length - 1]?.shift ||
    assignments[0]?.shift ||
    null;

  for (const date of monthDates) {
    const shift = getShiftForDate(assignments, date) || fallbackShift;
    if (!shift?.workingDays?.length) continue;

    const dayName = formatInTimeZone(date, PAKISTAN_TZ, "EEEE");
    if (shift.workingDays.includes(dayName)) {
      scheduledDates.push(date);
    }
  }

  return scheduledDates;
};

const buildLeaveMap = async ({
  employeeId,
  monthStartUtc,
  nextMonthStartUtc,
}) => {
  const approvedLeaves = await LeaveApplication.find({
    employee: employeeId,
    status: "Approved",
    dates: { $gte: monthStartUtc, $lt: nextMonthStartUtc },
  }).populate("leaveType", "isPaid");

  const leaveByDate = new Map();

  for (const leave of approvedLeaves) {
    const isPaid = Boolean(leave.leaveType?.isPaid);
    for (const leaveDate of leave.dates || []) {
      const date = new Date(leaveDate);
      if (date < monthStartUtc || date >= nextMonthStartUtc) continue;
      leaveByDate.set(keyByPKDate(date), isPaid);
    }
  }

  return leaveByDate;
};

export const classifyDay = ({ attendance, leaveMap, dateKey }) => {
  if (!attendance) {
    return { type: "absent", payableFactor: 0 };
  }

  if (attendance.status === "Leave") {
    const isPaid = leaveMap.get(dateKey);
    if (isPaid) return { type: "paidLeave", payableFactor: 1 };
    return { type: "unpaidLeave", payableFactor: 0 };
  }

  if (attendance.status === "Off") {
    return { type: "off", payableFactor: 0 };
  }

  if (attendance.status === "Half Day") {
    return { type: "halfDay", payableFactor: 0.5 };
  }

  if (attendance.status === "Late") {
    return { type: "late", payableFactor: 1 };
  }

  if (attendance.status === "Present") {
    return { type: "present", payableFactor: 1 };
  }

  return { type: "absent", payableFactor: 0 };
};

const buildAttendanceMap = async ({
  employeeId,
  monthStartUtc,
  nextMonthStartUtc,
}) => {
  const attendanceRecords = await Attendance.find({
    employee: employeeId,
    date: { $gte: monthStartUtc, $lt: nextMonthStartUtc },
  })
    .sort({ date: 1 })
    .lean();

  const byDate = new Map();
  for (const record of attendanceRecords) {
    byDate.set(keyByPKDate(record.date), record);
  }
  return byDate;
};

export const calculateLatePenalty = (lateDayRates) => {
  const groups = Math.floor(lateDayRates.length / 3);
  if (!groups) {
    return {
      basicPenaltyAmount: 0,
      allowancePenaltyAmount: 0,
      totalPenaltyAmount: 0,
    };
  }

  let basicPenaltyAmount = 0;
  let allowancePenaltyAmount = 0;
  for (let index = 0; index < groups; index += 1) {
    const triggerRates =
      lateDayRates[index * 3 + 2] ||
      lateDayRates[lateDayRates.length - 1] ||
      { basicPerDay: 0, allowancePerDay: 0 };

    basicPenaltyAmount += Number(triggerRates.basicPerDay || 0) * 0.5;
    allowancePenaltyAmount += Number(triggerRates.allowancePerDay || 0) * 0.5;
  }

  const roundedBasicPenaltyAmount = roundMoney(basicPenaltyAmount);
  const roundedAllowancePenaltyAmount = roundMoney(allowancePenaltyAmount);

  return {
    basicPenaltyAmount: roundedBasicPenaltyAmount,
    allowancePenaltyAmount: roundedAllowancePenaltyAmount,
    totalPenaltyAmount: roundMoney(
      roundedBasicPenaltyAmount + roundedAllowancePenaltyAmount,
    ),
  };
};

export const calculateEmployeePayroll = async ({
  employee,
  year,
  month,
  generatedBy,
  mode = "normal",
  includeArrears = true,
  includeFinancialAdjustments = true,
  skipArrearsSync = false,
  session = null,
}) => {
  const { monthStartUtc, nextMonthStartUtc } = getMonthStartEndUtcForPakistan(
    year,
    month,
  );

  const [salaryHistory, allowanceHistory] = await Promise.all([
    BasicSalaryHistory.find({
      employee: employee._id,
      effectiveDate: { $lt: nextMonthStartUtc },
    })
      .session(session)
      .sort({ effectiveDate: 1 })
      .lean(),
    EmployeeAllowanceHistory.find({
      employee: employee._id,
      effectiveDate: { $lt: nextMonthStartUtc },
    })
      .populate("fromAllowances.allowanceComponent", "name")
      .populate("toAllowances.allowanceComponent", "name")
      .session(session)
      .sort({ effectiveDate: 1 })
      .lean(),
  ]);

  const normalizedSalaryHistory = salaryHistory.map((entry) => ({
    ...entry,
    effectiveDate: new Date(entry.effectiveDate),
  }));

  const normalizedAllowanceHistory = allowanceHistory.map((entry) => ({
    ...entry,
    effectiveDate: new Date(entry.effectiveDate),
  }));

  const [scheduledDates, attendanceMap, leaveMap] = await Promise.all([
    getScheduledDatesForPayrollDivisor({
      employeeId: employee._id,
      monthStartUtc,
      nextMonthStartUtc,
    }),
    buildAttendanceMap({
      employeeId: employee._id,
      monthStartUtc,
      nextMonthStartUtc,
    }),
    buildLeaveMap({
      employeeId: employee._id,
      monthStartUtc,
      nextMonthStartUtc,
    }),
  ]);

  const monthDates = getAllDatesInRange(monthStartUtc, nextMonthStartUtc);
  const calendarDaysInMonth = getCalendarDaysInMonth(year, month);
  const employmentBounds = {
    joiningDate: normalizeUtcDate(employee.joiningDate),
    resignationDate: normalizeUtcDate(employee.resignationDate),
  };
  const totalScheduledDays = scheduledDates.filter(
    (date) => !isOutsideEmploymentWindow(date, employmentBounds),
  ).length;
  const employedDaysInMonth = monthDates.filter(
    (date) => !isOutsideEmploymentWindow(date, employmentBounds),
  ).length;

  if (employedDaysInMonth > 0 && totalScheduledDays === 0) {
    throw new PayrollGenerationError(
      "No working shift schedule is assigned for this employee in the payroll month.",
      "NO_SHIFT_SCHEDULE",
    );
  }

  let present = 0;
  let absences = 0;
  let leaves = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let halfDay = 0;
  let late = 0;
  const lateDayRates = [];

  const salarySegmentsMap = new Map();
  let payableDayUnitsTotal = 0;

  let payableBasicSalaryAmount = 0;
  let payableAllowanceAmount = 0;
  let fullBasicSalaryAmount = 0;
  let fullAllowanceAmount = 0;
  const attendanceDeductionTracker = {
    absent: {
      key: "absent",
      label: "Absent",
      count: 0,
      basicAmount: 0,
      allowanceAmount: 0,
    },
    unpaidLeave: {
      key: "unpaidLeave",
      label: "Unpaid Leave",
      count: 0,
      basicAmount: 0,
      allowanceAmount: 0,
    },
    halfDay: {
      key: "halfDay",
      label: "Half Day",
      count: 0,
      basicAmount: 0,
      allowanceAmount: 0,
    },
  };

  for (const date of monthDates) {
    if (isOutsideEmploymentWindow(date, employmentBounds)) {
      continue;
    }

    const basicSalaryMonthly = getSalaryFromHistory(
      employee,
      normalizedSalaryHistory,
      date,
    );

    const allowanceSnapshot = getAllowancesFromHistory(
      employee,
      normalizedAllowanceHistory,
      date,
    );
    const allowanceMonthly = sumAllowances(allowanceSnapshot);

    const divisor = calendarDaysInMonth || 1;
    const basicPerDay = Number(basicSalaryMonthly || 0) / divisor;
    const allowancePerDay = Number(allowanceMonthly || 0) / divisor;

    fullBasicSalaryAmount += basicPerDay;
    fullAllowanceAmount += allowancePerDay;

    const segmentKey = [
      Number(basicSalaryMonthly || 0),
      roundMoney(allowanceMonthly || 0),
    ].join("::");

    if (!salarySegmentsMap.has(segmentKey)) {
      salarySegmentsMap.set(segmentKey, {
        startDate: date,
        endDate: date,
        basicSalary: Number(basicSalaryMonthly || 0),
        allowancePolicy: null,
        allowanceAmount: Number(allowanceMonthly || 0),
        payableDayUnits: 0,
        segmentBasicAmount: 0,
        segmentAllowanceAmount: 0,
      });
    }

    const segment = salarySegmentsMap.get(segmentKey);
    segment.endDate = date;
    segment.payableDayUnits += 1;
    segment.segmentBasicAmount += basicPerDay;
    segment.segmentAllowanceAmount += allowancePerDay;
  }

  for (const date of scheduledDates) {
    if (isOutsideEmploymentWindow(date, employmentBounds)) {
      continue;
    }

    const dateKey = keyByPKDate(date);
    const attendance = attendanceMap.get(dateKey);
    const dayState = classifyDay({ attendance, leaveMap, dateKey });

    if (dayState.type === "present") present += 1;
    if (dayState.type === "absent") absences += 1;
    if (dayState.type === "paidLeave") {
      leaves += 1;
      paidLeaves += 1;
    }
    if (dayState.type === "unpaidLeave") {
      leaves += 1;
      unpaidLeaves += 1;
    }
    if (dayState.type === "halfDay") halfDay += 1;
    if (dayState.type === "late") late += 1;
    payableDayUnitsTotal += dayState.payableFactor;

    const basicSalaryMonthly = getSalaryFromHistory(
      employee,
      normalizedSalaryHistory,
      date,
    );

    const allowanceSnapshot = getAllowancesFromHistory(
      employee,
      normalizedAllowanceHistory,
      date,
    );
    const allowanceMonthly = sumAllowances(allowanceSnapshot);

    const dayDeduction = calculateAttendanceDeductionFromCounts({
      basicSalaryMonthly,
      allowanceMonthly,
      calendarDaysInMonth,
      absences: dayState.type === "absent" ? 1 : 0,
      unpaidLeaves: dayState.type === "unpaidLeave" ? 1 : 0,
      halfDays: dayState.type === "halfDay" ? 1 : 0,
    });

    for (const item of dayDeduction.breakdown) {
      const tracker = attendanceDeductionTracker[item.key];
      if (!tracker) continue;
      tracker.count += Number(item.count || 0);
      tracker.basicAmount += Number(item.basicAmount || 0);
      tracker.allowanceAmount += Number(item.allowanceAmount || 0);
    }

    if (dayState.type === "late") {
      lateDayRates.push({
        basicPerDay: Number(basicSalaryMonthly || 0) / (calendarDaysInMonth || 1),
        allowancePerDay:
          Number(allowanceMonthly || 0) / (calendarDaysInMonth || 1),
      });
    }
  }

  const grossSalary = roundMoney(fullBasicSalaryAmount + fullAllowanceAmount);
  const roundedFullBasicSalaryAmount = roundMoney(fullBasicSalaryAmount);
  const roundedFullAllowanceAmount = roundMoney(fullAllowanceAmount);
  const attendanceDeductionBreakdown = Object.values(
    attendanceDeductionTracker,
  )
    .filter(
      (item) =>
        item.count > 0 ||
        Math.abs(item.basicAmount) > 0 ||
        Math.abs(item.allowanceAmount) > 0,
    )
    .map((item) => ({
      ...item,
      basicAmount: roundMoney(item.basicAmount),
      allowanceAmount: roundMoney(item.allowanceAmount),
      totalAmount: roundMoney(item.basicAmount + item.allowanceAmount),
    }));
  const attendanceDeductionAmount = roundMoney(
    attendanceDeductionBreakdown.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0,
    ),
  );
  const basicSalaryDeductionAmount = roundMoney(
    attendanceDeductionBreakdown.reduce(
      (sum, item) => sum + Number(item.basicAmount || 0),
      0,
    ),
  );
  const allowanceDeductionAmount = roundMoney(
    attendanceDeductionBreakdown.reduce(
      (sum, item) => sum + Number(item.allowanceAmount || 0),
      0,
    ),
  );
  payableBasicSalaryAmount = roundMoney(
    roundedFullBasicSalaryAmount - basicSalaryDeductionAmount,
  );
  payableAllowanceAmount = roundMoney(
    roundedFullAllowanceAmount - allowanceDeductionAmount,
  );

  if (!skipArrearsSync) {
    await syncArrearsForEmployee({
      employee,
      targetYear: year,
      targetMonth: month,
      generatedBy,
      session,
    });
  }

  const unsettledArrearsEntries =
    includeArrears && includeFinancialAdjustments
    ? await PayrollArrearsLedger.find({
        employee: employee._id,
        settled: false,
      })
        .session(session)
        .sort({ sourceYear: 1, sourceMonth: 1 })
        .lean()
    : [];

  const arrearsAmount = roundMoney(
    unsettledArrearsEntries
      .filter((entry) =>
        isEarlierMonth(entry.sourceYear, entry.sourceMonth, year, month),
      )
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  );

  // ── Manual Deductions ──
  const deductionRecords = includeFinancialAdjustments
    ? await Deduction.find({
        employee: employee._id,
        $and: [
          {
            status: "Approved",
          },
          {
            $or: [
              { currentDueYear: { $lt: Number(year) } },
              {
                currentDueYear: Number(year),
                currentDueMonth: { $lte: Number(month) },
              },
            ],
          },
        ],
      })
        .sort({ currentDueYear: 1, currentDueMonth: 1, date: 1, createdAt: 1 })
        .lean()
    : [];

  const latePenaltyInfo = calculateLatePenalty(lateDayRates);
  const latePenaltyAmount = roundMoney(latePenaltyInfo.totalPenaltyAmount);

  const salaryBeforeManualDeductions = roundMoney(
    grossSalary - attendanceDeductionAmount - latePenaltyAmount + arrearsAmount,
  );
  const manualDeductionPlan = calculateManualDeductionPlan({
    deductions: deductionRecords,
    salaryAvailable: salaryBeforeManualDeductions,
    payrollYear: Number(year),
    payrollMonth: Number(month),
  });
  const manualDeductionAmount = roundMoney(manualDeductionPlan.deductedAmount);
  const deductionBreakdown = manualDeductionPlan.breakdown;

  // ── Loan Deduction ──
  const activeLoan = includeFinancialAdjustments
    ? await Loan.findOne({
        employee: employee._id,
        status: "Approved",
        repaymentSchedule: {
          $elemMatch: {
            year: Number(year),
            month: Number(month),
            status: "Pending",
          },
        },
      }).lean()
    : null;
  const salaryBeforeLoan = roundMoney(
    grossSalary -
      attendanceDeductionAmount -
      latePenaltyAmount -
      manualDeductionAmount +
      arrearsAmount,
  );
  const { loanDeductionAmount, loanDeductionBreakdown } =
    calculateLoanDeductionForPayroll({
      activeLoan,
      year: Number(year),
      month: Number(month),
      salaryAvailable: salaryBeforeLoan,
    });

  const totalSalary = roundMoney(
    grossSalary -
      attendanceDeductionAmount -
      latePenaltyAmount -
      manualDeductionAmount -
      loanDeductionAmount +
      arrearsAmount,
  );

  const monthEndDate = new Date(nextMonthStartUtc);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1);

  const monthEndAllowances = getAllowancesFromHistory(
    employee,
    normalizedAllowanceHistory,
    monthEndDate,
  );
  const allowanceBreakdown = getAllowanceBreakdown(monthEndAllowances);

  return {
    employee: employee._id,
    employeeSnapshot: {
      employeeID: employee.employeeID,
      fullName: employee.fullName,
      basicSalary: Number(employee.basicSalary || 0),
      joiningDate: employee.joiningDate || null,
      resignationDate: employee.resignationDate || null,
      positionName: employee.position?.name || "-",
      departmentName: employee.position?.department?.name || "-",
      status: employee.status,
    },
    year: Number(year),
    month: Number(month),
    workingDays: {
      totalScheduled: totalScheduledDays,
      present,
      absences,
      leaves,
      paidLeaves,
      unpaidLeaves,
      halfDay,
      late,
    },
    salarySegments: [...salarySegmentsMap.values()].map((segment) => ({
      ...segment,
      segmentBasicAmount: roundMoney(segment.segmentBasicAmount),
      segmentAllowanceAmount: roundMoney(segment.segmentAllowanceAmount),
      payableDayUnits: round2(segment.payableDayUnits),
    })),
    calculations: {
      grossSalary,
      calculationVersion: "v2",
      calendarDaysInMonth,
      fullBasicSalaryAmount: roundedFullBasicSalaryAmount,
      fullAllowanceAmount: roundedFullAllowanceAmount,
      basicSalaryAmount: payableBasicSalaryAmount,
      allowanceAmount: payableAllowanceAmount,
      basicSalaryDeductionAmount,
      allowanceDeductionAmount,
      attendanceDeductionAmount,
      attendanceDeductionDayUnits: round2(
        Number(absences || 0) + Number(unpaidLeaves || 0) + Number(halfDay || 0) * 0.5,
      ),
      allowanceRatio: round2(
        grossSalary > 0 ? payableAllowanceAmount / grossSalary : 0,
      ),
      payableDayUnits: round2(payableDayUnitsTotal),
      latePenaltyBasicAmount: latePenaltyInfo.basicPenaltyAmount,
      latePenaltyAllowanceAmount: latePenaltyInfo.allowancePenaltyAmount,
      latePenaltyAmount,
      manualDeductionAmount,
      loanDeductionAmount,
      arrearsAmount,
      totalSalary,
      perDaySalary: roundMoney(
        grossSalary / (calendarDaysInMonth || 1),
      ),
      scheduledDays: calendarDaysInMonth,
      earnedBasic: roundMoney(
        roundedFullBasicSalaryAmount - basicSalaryDeductionAmount,
      ),
      paidLeaveAmount: roundMoney(0),
      halfDayDeduction: roundMoney(
        attendanceDeductionBreakdown.find((item) => item.key === "halfDay")
          ?.totalAmount || 0,
      ),
      lateCount: late,
      latePenaltyGroups: Math.floor(lateDayRates.length / 3),
      netSalary: totalSalary,
    },
    attendanceDeductionBreakdown,
    deductionBreakdown,
    allowanceBreakdown,
    loanDeductionBreakdown,
    arrearsLedgerEntries: unsettledArrearsEntries
      .filter((entry) =>
        isEarlierMonth(entry.sourceYear, entry.sourceMonth, year, month),
      )
      .map((entry) => entry._id),
    generatedBy,
    generatedAt: new Date(),
    generationMode: mode,
  };
};

export const settleArrearsForPayroll = async ({
  payrollId,
  arrearsLedgerEntryIds = [],
  session = null,
}) => {
  if (!arrearsLedgerEntryIds.length) return;

  await PayrollArrearsLedger.updateMany(
    { _id: { $in: arrearsLedgerEntryIds } },
    {
      $set: {
        settled: true,
        settledByPayrollId: payrollId,
        settledAt: new Date(),
      },
    },
    { session },
  );
};

export const rollbackArrearsSettledByPayroll = async (
  payrollId,
  session = null,
) => {
  if (!payrollId) return;

  await PayrollArrearsLedger.updateMany(
    { settledByPayrollId: payrollId },
    {
      $set: {
        settled: false,
        settledByPayrollId: null,
        settledAt: null,
      },
    },
    { session },
  );
};

export const syncArrearsForEmployee = async ({
  employee,
  targetYear,
  targetMonth,
  generatedBy,
  session = null,
}) => {
  const previousPayrolls = await Payroll.find({
    employee: employee._id,
    $or: [
      { year: { $lt: Number(targetYear) } },
      { year: Number(targetYear), month: { $lt: Number(targetMonth) } },
    ],
  })
    .session(session)
    .sort({ year: 1, month: 1 })
    .lean();

  if (previousPayrolls.length === 0) return;

  // Prefetch all existing ledger entries for the relevant months in one query.
  // Previously the loop called findOne N times (once per previous payroll, including
  // already-settled ones). This replaces all those roundtrips with a single find.
  const existingLedgers = await PayrollArrearsLedger.find({
    employee: employee._id,
    $or: [
      { sourceYear: { $lt: Number(targetYear) } },
      { sourceYear: Number(targetYear), sourceMonth: { $lt: Number(targetMonth) } },
    ],
  })
    .session(session)
    .lean();

  const ledgerMap = new Map(
    existingLedgers.map((l) => [`${l.sourceYear}-${l.sourceMonth}`, l]),
  );

  for (const payroll of previousPayrolls) {
    const existingLedger = ledgerMap.get(`${payroll.year}-${payroll.month}`) || null;

    if (existingLedger?.settled) {
      continue;
    }

    const recomputed = await calculateEmployeePayroll({
      employee,
      year: payroll.year,
      month: payroll.month,
      generatedBy,
      mode: "regenerate",
      includeArrears: false,
      includeFinancialAdjustments: false,
      skipArrearsSync: true,
      session,
    });

    const expectedWithoutArrears = roundMoney(
      Number(recomputed.calculations.grossSalary || 0) -
        Number(recomputed.calculations.attendanceDeductionAmount || 0) -
        Number(recomputed.calculations.latePenaltyAmount || 0),
    );

    const existingWithoutArrears = roundMoney(
      Number(payroll.calculations?.grossSalary || 0) -
        Number(payroll.calculations?.attendanceDeductionAmount || 0) -
        Number(payroll.calculations?.latePenaltyAmount || 0),
    );

    const diff = roundMoney(expectedWithoutArrears - existingWithoutArrears);

    if (Math.abs(diff) < 1) {
      if (existingLedger && !existingLedger.settled) {
        await PayrollArrearsLedger.deleteOne(
          { _id: existingLedger._id },
          { session },
        );
      }
      continue;
    }

    if (existingLedger) {
      // Re-fetch the live Mongoose document so we can call .save() on it
      const liveLedger = await PayrollArrearsLedger.findById(existingLedger._id).session(session);
      if (liveLedger) {
        liveLedger.amount = diff;
        liveLedger.reason = "Backdated effective date adjustment";
        liveLedger.createdBy = generatedBy || liveLedger.createdBy;
        await liveLedger.save();
      }
    } else {
      await PayrollArrearsLedger.create(
        [
          {
            employee: employee._id,
            sourceYear: payroll.year,
            sourceMonth: payroll.month,
            amount: diff,
            reason: "Backdated effective date adjustment",
            createdBy: generatedBy || null,
          },
        ],
        { session },
      );
    }
  }
};
