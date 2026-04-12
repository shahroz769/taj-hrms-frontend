import Attendance from "../models/Attendance.js";
import Deduction from "../models/Deduction.js";
import Loan from "../models/Loan.js";
import EmployeeShift from "../models/EmployeeShift.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payroll from "../models/Payroll.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import BasicSalaryHistory from "../models/BasicSalaryHistory.js";
import AllowancePolicyHistory from "../models/AllowancePolicyHistory.js";
import AllowancePolicyAmountHistory from "../models/AllowancePolicyAmountHistory.js";
import {
  getMonthStartEndUtcForPakistan,
  PAKISTAN_TZ,
} from "../utils/timezone.js";
import { formatInTimeZone } from "date-fns-tz";

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

const keyByPKDate = (date) => formatInTimeZone(date, PAKISTAN_TZ, "yyyy-MM-dd");

const normalizeUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(0, 0, 0, 0);
  return date;
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

const sumPolicyComponents = (components = []) =>
  components.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const getAllowanceBreakdown = (policy, components) => {
  if (!policy) return [];

  const namesById = new Map(
    (policy.components || []).map((component) => {
      const id =
        component.allowanceComponent?._id?.toString() ||
        component.allowanceComponent?.toString();
      const name = component.allowanceComponent?.name || "Allowance";
      return [id, name];
    }),
  );

  return (components || []).map((component) => ({
    name:
      namesById.get(
        component.allowanceComponent?._id?.toString() ||
          component.allowanceComponent?.toString(),
      ) || "Allowance",
    amount: Number(component.amount || 0),
  }));
};

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

const getPolicyIdFromHistory = (employee, assignmentHistory, date) => {
  const fallback =
    employee.allowancePolicy?._id?.toString() ||
    employee.allowancePolicy?.toString() ||
    null;

  if (!assignmentHistory?.length) return fallback;

  const first = assignmentHistory[0];
  if (date < first.effectiveDate) {
    return first.fromAllowancePolicy?.toString() || fallback;
  }

  let policyId = fallback;
  for (const entry of assignmentHistory) {
    if (entry.effectiveDate <= date) {
      policyId = entry.toAllowancePolicy?.toString() || null;
    } else {
      break;
    }
  }

  return policyId;
};

const getPolicyComponentsForDate = ({ policy, amountHistory = [], date }) => {
  if (!policy) return { components: [], amount: 0 };

  if (!amountHistory.length) {
    const components = policy.components || [];
    return { components, amount: sumPolicyComponents(components) };
  }

  const first = amountHistory[0];
  if (date < first.effectiveDate) {
    const components = first.fromComponents || [];
    return { components, amount: sumPolicyComponents(components) };
  }

  let components = policy.components || [];
  for (const item of amountHistory) {
    if (item.effectiveDate <= date) {
      components = item.toComponents || [];
    } else {
      break;
    }
  }

  return { components, amount: sumPolicyComponents(components) };
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

const getPoliciesByIds = async (
  policyIds,
  AllowancePolicyModel,
  session = null,
) => {
  const uniquePolicyIds = [...new Set(policyIds.filter(Boolean))];
  if (!uniquePolicyIds.length) return new Map();

  const policies = await AllowancePolicyModel.find({
    _id: { $in: uniquePolicyIds },
  })
    .session(session)
    .populate("components.allowanceComponent", "name");

  return new Map(policies.map((policy) => [policy._id.toString(), policy]));
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

  const roundedBasicPenaltyAmount = round2(basicPenaltyAmount);
  const roundedAllowancePenaltyAmount = round2(allowancePenaltyAmount);

  return {
    basicPenaltyAmount: roundedBasicPenaltyAmount,
    allowancePenaltyAmount: roundedAllowancePenaltyAmount,
    totalPenaltyAmount: round2(
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
  skipArrearsSync = false,
  AllowancePolicyModel,
  session = null,
}) => {
  const { monthStartUtc, nextMonthStartUtc } = getMonthStartEndUtcForPakistan(
    year,
    month,
  );

  const [salaryHistory, assignmentHistory] = await Promise.all([
    BasicSalaryHistory.find({
      employee: employee._id,
      effectiveDate: { $lt: nextMonthStartUtc },
    })
      .session(session)
      .sort({ effectiveDate: 1 })
      .lean(),
    AllowancePolicyHistory.find({
      employee: employee._id,
      effectiveDate: { $lt: nextMonthStartUtc },
    })
      .session(session)
      .sort({ effectiveDate: 1 })
      .lean(),
  ]);

  const policyIdsFromHistory = assignmentHistory.flatMap((entry) => [
    entry.fromAllowancePolicy?.toString(),
    entry.toAllowancePolicy?.toString(),
  ]);

  const policyIds = [
    employee.allowancePolicy?._id?.toString() ||
      employee.allowancePolicy?.toString(),
    ...policyIdsFromHistory,
  ];

  const policiesMap = await getPoliciesByIds(
    policyIds,
    AllowancePolicyModel,
    session,
  );

  const amountHistories = await AllowancePolicyAmountHistory.find({
    allowancePolicy: { $in: [...policiesMap.keys()] },
    effectiveDate: { $lt: nextMonthStartUtc },
  })
    .session(session)
    .sort({ effectiveDate: 1 })
    .lean();

  const amountHistoryMap = new Map();
  for (const history of amountHistories) {
    const key = history.allowancePolicy.toString();
    if (!amountHistoryMap.has(key)) amountHistoryMap.set(key, []);
    amountHistoryMap.get(key).push({
      ...history,
      effectiveDate: new Date(history.effectiveDate),
    });
  }

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

  const totalScheduledDays = scheduledDates.length;
  const employmentBounds = {
    joiningDate: normalizeUtcDate(employee.joiningDate),
    resignationDate: normalizeUtcDate(employee.resignationDate),
  };

  let present = 0;
  let absences = 0;
  let leaves = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let halfDay = 0;
  let late = 0;

  const salarySegmentsMap = new Map();
  const lateDayRates = [];
  let payableDayUnitsTotal = 0;

  let basicSalaryAmount = 0;
  let allowanceAmount = 0;
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

    const basicSalaryMonthly = getSalaryFromHistory(
      employee,
      salaryHistory.map((entry) => ({
        ...entry,
        effectiveDate: new Date(entry.effectiveDate),
      })),
      date,
    );

    const policyId = getPolicyIdFromHistory(
      employee,
      assignmentHistory.map((entry) => ({
        ...entry,
        effectiveDate: new Date(entry.effectiveDate),
      })),
      date,
    );

    const policy = policyId ? policiesMap.get(policyId) : null;
    const policyComponentsInfo = getPolicyComponentsForDate({
      policy,
      amountHistory: amountHistoryMap.get(policyId) || [],
      date,
    });

    const divisor = totalScheduledDays || 1;
    const basicPerDay = Number(basicSalaryMonthly || 0) / divisor;
    const allowancePerDay = Number(policyComponentsInfo.amount || 0) / divisor;

    fullBasicSalaryAmount += basicPerDay;
    fullAllowanceAmount += allowancePerDay;

    const payableFactor = dayState.payableFactor;
    payableDayUnitsTotal += payableFactor;

    basicSalaryAmount += basicPerDay * payableFactor;
    allowanceAmount += allowancePerDay * payableFactor;

    if (dayState.type === "absent") {
      attendanceDeductionTracker.absent.count += 1;
      attendanceDeductionTracker.absent.basicAmount += basicPerDay;
      attendanceDeductionTracker.absent.allowanceAmount += allowancePerDay;
    }

    if (dayState.type === "unpaidLeave") {
      attendanceDeductionTracker.unpaidLeave.count += 1;
      attendanceDeductionTracker.unpaidLeave.basicAmount += basicPerDay;
      attendanceDeductionTracker.unpaidLeave.allowanceAmount +=
        allowancePerDay;
    }

    if (dayState.type === "halfDay") {
      attendanceDeductionTracker.halfDay.count += 1;
      attendanceDeductionTracker.halfDay.basicAmount += basicPerDay * 0.5;
      attendanceDeductionTracker.halfDay.allowanceAmount +=
        allowancePerDay * 0.5;
    }

    if (dayState.type === "late") {
      lateDayRates.push({ basicPerDay, allowancePerDay });
    }

    const segmentKey = [
      keyByPKDate(date),
      Number(basicSalaryMonthly || 0),
      policyId || "none",
      round2(policyComponentsInfo.amount || 0),
    ].join("::");

    if (!salarySegmentsMap.has(segmentKey)) {
      salarySegmentsMap.set(segmentKey, {
        startDate: date,
        endDate: date,
        basicSalary: Number(basicSalaryMonthly || 0),
        allowancePolicy: policyId || null,
        allowanceAmount: Number(policyComponentsInfo.amount || 0),
        payableDayUnits: 0,
        segmentBasicAmount: 0,
        segmentAllowanceAmount: 0,
      });
    }

    const segment = salarySegmentsMap.get(segmentKey);
    segment.endDate = date;
    segment.payableDayUnits += payableFactor;
    segment.segmentBasicAmount += basicPerDay * payableFactor;
    segment.segmentAllowanceAmount += allowancePerDay * payableFactor;
  }

  const latePenaltyInfo = calculateLatePenalty(lateDayRates);
  const latePenaltyAmount = latePenaltyInfo.totalPenaltyAmount;
  const grossSalary = round2(basicSalaryAmount + allowanceAmount);
  const roundedFullBasicSalaryAmount = round2(fullBasicSalaryAmount);
  const roundedFullAllowanceAmount = round2(fullAllowanceAmount);
  const attendanceDeductionBreakdown = Object.values(
    attendanceDeductionTracker,
  )
    .filter(
      (item) =>
        item.count > 0 ||
        Math.abs(item.basicAmount) > 0.009 ||
        Math.abs(item.allowanceAmount) > 0.009,
    )
    .map((item) => ({
      ...item,
      basicAmount: round2(item.basicAmount),
      allowanceAmount: round2(item.allowanceAmount),
      totalAmount: round2(item.basicAmount + item.allowanceAmount),
    }));
  const attendanceDeductionAmount = round2(
    attendanceDeductionBreakdown.reduce(
      (sum, item) => sum + Number(item.totalAmount || 0),
      0,
    ),
  );
  const basicSalaryDeductionAmount = round2(
    roundedFullBasicSalaryAmount - round2(basicSalaryAmount),
  );
  const allowanceDeductionAmount = round2(
    roundedFullAllowanceAmount - round2(allowanceAmount),
  );

  if (!skipArrearsSync) {
    await syncArrearsForEmployee({
      employee,
      targetYear: year,
      targetMonth: month,
      generatedBy,
      AllowancePolicyModel,
      session,
    });
  }

  const unsettledArrearsEntries = includeArrears
    ? await PayrollArrearsLedger.find({
        employee: employee._id,
        settled: false,
      })
        .session(session)
        .sort({ sourceYear: 1, sourceMonth: 1 })
        .lean()
    : [];

  const arrearsAmount = round2(
    unsettledArrearsEntries
      .filter((entry) =>
        isEarlierMonth(entry.sourceYear, entry.sourceMonth, year, month),
      )
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
  );

  // ── Manual Deductions ──
  const { monthStartUtc: deductionMonthStart, nextMonthStartUtc: deductionMonthEnd } =
    getMonthStartEndUtcForPakistan(year, month);

  const deductionRecords = await Deduction.find({
    employee: employee._id,
    date: { $gte: deductionMonthStart, $lt: deductionMonthEnd },
  })
    .sort({ date: 1 })
    .lean();

  const manualDeductionAmount = round2(
    deductionRecords.reduce((sum, d) => sum + Number(d.amount || 0), 0),
  );

  const deductionBreakdown = deductionRecords.map((d) => ({
    reason: d.reason || "Deduction",
    amount: Number(d.amount || 0),
    date: d.date,
  }));

  // ── Loan Deduction ──
  let loanDeductionAmount = 0;
  const loanDeductionBreakdown = [];

  const activeLoan = await Loan.findOne({
    employee: employee._id,
    status: "Approved",
    "repaymentSchedule.year": year,
    "repaymentSchedule.month": month,
    "repaymentSchedule.status": "Pending",
  }).lean();

  if (activeLoan) {
    const scheduleIndex = activeLoan.repaymentSchedule.findIndex(
      (entry) => entry.year === year && entry.month === month && entry.status === "Pending",
    );

    if (scheduleIndex !== -1) {
      const entry = activeLoan.repaymentSchedule[scheduleIndex];
      const salaryBeforeLoan = round2(
        grossSalary - latePenaltyAmount - manualDeductionAmount + arrearsAmount,
      );

      if (activeLoan.repaymentType === "next_salary") {
        // For next_salary: deduct as much as possible from available net salary
        const deductible = Math.max(0, Math.floor(salaryBeforeLoan));
        loanDeductionAmount = Math.min(activeLoan.remainingBalance, deductible);
      } else {
        // For fixed_amount / fixed_months: deduct scheduled amount (whole numbers)
        loanDeductionAmount = Math.min(entry.amount, activeLoan.remainingBalance);
      }

      // Count installment number (how many Paid/Partial before this one + 1)
      const paidBefore = activeLoan.repaymentSchedule.filter(
        (e) => e.status === "Paid" || e.status === "Partial",
      ).length;
      const totalInstallments = activeLoan.repaymentSchedule.length;

      loanDeductionBreakdown.push({
        loan: activeLoan._id,
        installmentAmount: round2(loanDeductionAmount),
        installmentNumber: paidBefore + 1,
        totalInstallments,
        remainingBalance: round2(activeLoan.remainingBalance - loanDeductionAmount),
      });
    }
  }

  const totalSalary = round2(grossSalary - latePenaltyAmount - manualDeductionAmount - loanDeductionAmount + arrearsAmount);

  const monthEndDate = new Date(nextMonthStartUtc);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1);

  const monthEndPolicyId = getPolicyIdFromHistory(
    employee,
    assignmentHistory.map((entry) => ({
      ...entry,
      effectiveDate: new Date(entry.effectiveDate),
    })),
    monthEndDate,
  );
  const monthEndPolicy = monthEndPolicyId
    ? policiesMap.get(monthEndPolicyId)
    : null;
  const monthEndComponents = getPolicyComponentsForDate({
    policy: monthEndPolicy,
    amountHistory: amountHistoryMap.get(monthEndPolicyId) || [],
    date: monthEndDate,
  }).components;

  const allowanceBreakdown = getAllowanceBreakdown(
    monthEndPolicy,
    monthEndComponents,
  );

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
      segmentBasicAmount: round2(segment.segmentBasicAmount),
      segmentAllowanceAmount: round2(segment.segmentAllowanceAmount),
      payableDayUnits: round2(segment.payableDayUnits),
    })),
    calculations: {
      grossSalary,
      fullBasicSalaryAmount: roundedFullBasicSalaryAmount,
      fullAllowanceAmount: roundedFullAllowanceAmount,
      basicSalaryAmount: round2(basicSalaryAmount),
      allowanceAmount: round2(allowanceAmount),
      basicSalaryDeductionAmount,
      allowanceDeductionAmount,
      attendanceDeductionAmount,
      allowanceRatio: round2(payableDayUnitsTotal / (totalScheduledDays || 1)),
      payableDayUnits: round2(payableDayUnitsTotal),
      latePenaltyBasicAmount: latePenaltyInfo.basicPenaltyAmount,
      latePenaltyAllowanceAmount: latePenaltyInfo.allowancePenaltyAmount,
      latePenaltyAmount,
      manualDeductionAmount,
      loanDeductionAmount,
      arrearsAmount,
      totalSalary,
      perDaySalary: round2(
        Number(
          getSalaryFromHistory(
            employee,
            salaryHistory.map((entry) => ({
              ...entry,
              effectiveDate: new Date(entry.effectiveDate),
            })),
            new Date(nextMonthStartUtc.getTime() - 86400000),
          ) || 0,
        ) / (totalScheduledDays || 1),
      ),
      scheduledDays: totalScheduledDays,
      earnedBasic: round2(
        (Number(
          getSalaryFromHistory(
            employee,
            salaryHistory.map((entry) => ({
              ...entry,
              effectiveDate: new Date(entry.effectiveDate),
            })),
            new Date(nextMonthStartUtc.getTime() - 86400000),
          ) || 0,
        ) /
          (totalScheduledDays || 1)) *
          present,
      ),
      paidLeaveAmount: round2(
        (Number(
          getSalaryFromHistory(
            employee,
            salaryHistory.map((entry) => ({
              ...entry,
              effectiveDate: new Date(entry.effectiveDate),
            })),
            new Date(nextMonthStartUtc.getTime() - 86400000),
          ) || 0,
        ) /
          (totalScheduledDays || 1)) *
          paidLeaves,
      ),
      halfDayDeduction: round2(
        (Number(
          getSalaryFromHistory(
            employee,
            salaryHistory.map((entry) => ({
              ...entry,
              effectiveDate: new Date(entry.effectiveDate),
            })),
            new Date(nextMonthStartUtc.getTime() - 86400000),
          ) || 0,
        ) /
          (totalScheduledDays || 1)) *
          halfDay *
          0.5,
      ),
      lateCount: late,
      latePenaltyGroups: Math.floor(late / 3),
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
  AllowancePolicyModel,
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
      skipArrearsSync: true,
      AllowancePolicyModel,
      session,
    });

    const expectedWithoutArrears = round2(
      Number(recomputed.calculations.grossSalary || 0) -
        Number(recomputed.calculations.latePenaltyAmount || 0),
    );

    const existingWithoutArrears = round2(
      Number(payroll.calculations?.grossSalary || 0) -
        Number(payroll.calculations?.latePenaltyAmount || 0),
    );

    const diff = round2(expectedWithoutArrears - existingWithoutArrears);

    if (Math.abs(diff) < 0.01) {
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
