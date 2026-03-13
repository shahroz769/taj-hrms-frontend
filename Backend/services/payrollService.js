import Attendance from "../models/Attendance.js";
import EmployeeShift from "../models/EmployeeShift.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payroll from "../models/Payroll.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import BasicSalaryHistory from "../models/BasicSalaryHistory.js";
import AllowancePolicyHistory from "../models/AllowancePolicyHistory.js";
import AllowancePolicyAmountHistory from "../models/AllowancePolicyAmountHistory.js";
import { getMonthStartEndUtcForPakistan, PAKISTAN_TZ } from "../utils/timezone.js";
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

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const keyByPKDate = (date) => formatInTimeZone(date, PAKISTAN_TZ, "yyyy-MM-dd");

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
      const id = component.allowanceComponent?._id?.toString() || component.allowanceComponent?.toString();
      const name = component.allowanceComponent?.name || "Allowance";
      return [id, name];
    })
  );

  return (components || []).map((component) => ({
    name: namesById.get(
      component.allowanceComponent?._id?.toString() || component.allowanceComponent?.toString()
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
  const fallback = employee.allowancePolicy?._id?.toString() || employee.allowancePolicy?.toString() || null;

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
    if (assignment.effectiveDate <= date && (!assignment.endDate || assignment.endDate >= date)) {
      return assignment.shift || null;
    }
  }

  return null;
};

const getWorkingDatesForEmployee = async ({ employeeId, monthStartUtc, nextMonthStartUtc }) => {
  const assignments = await EmployeeShift.find({
    employee: employeeId,
    effectiveDate: { $lt: nextMonthStartUtc },
    $or: [{ endDate: null }, { endDate: { $gte: monthStartUtc } }],
  })
    .populate("shift", "workingDays name")
    .sort({ effectiveDate: 1 });

  const monthDates = getAllDatesInRange(monthStartUtc, nextMonthStartUtc);
  const workingDates = [];

  for (const date of monthDates) {
    const shift = getShiftForDate(assignments, date);
    if (!shift?.workingDays?.length) continue;

    const dayName = formatInTimeZone(date, PAKISTAN_TZ, "EEEE");
    if (shift.workingDays.includes(dayName)) {
      workingDates.push(date);
    }
  }

  return workingDates;
};

const buildLeaveMap = async ({ employeeId, monthStartUtc, nextMonthStartUtc }) => {
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

const buildAttendanceMap = async ({ employeeId, monthStartUtc, nextMonthStartUtc }) => {
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

const getPoliciesByIds = async (policyIds, AllowancePolicyModel, session = null) => {
  const uniquePolicyIds = [...new Set(policyIds.filter(Boolean))];
  if (!uniquePolicyIds.length) return new Map();

  const policies = await AllowancePolicyModel.find({ _id: { $in: uniquePolicyIds } })
    .session(session)
    .populate(
    "components.allowanceComponent",
    "name"
  );

  return new Map(policies.map((policy) => [policy._id.toString(), policy]));
};

export const calculateLatePenalty = (lateDayBasicRates) => {
  const groups = Math.floor(lateDayBasicRates.length / 3);
  if (!groups) return 0;

  let totalPenalty = 0;
  for (let index = 0; index < groups; index += 1) {
    const triggerRate = lateDayBasicRates[index * 3 + 2] || lateDayBasicRates[lateDayBasicRates.length - 1] || 0;
    totalPenalty += triggerRate * 0.5;
  }

  return round2(totalPenalty);
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
  const { monthStartUtc, nextMonthStartUtc } = getMonthStartEndUtcForPakistan(year, month);

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
    employee.allowancePolicy?._id?.toString() || employee.allowancePolicy?.toString(),
    ...policyIdsFromHistory,
  ];

  const policiesMap = await getPoliciesByIds(policyIds, AllowancePolicyModel, session);

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

  const [workingDates, attendanceMap, leaveMap] = await Promise.all([
    getWorkingDatesForEmployee({ employeeId: employee._id, monthStartUtc, nextMonthStartUtc }),
    buildAttendanceMap({ employeeId: employee._id, monthStartUtc, nextMonthStartUtc }),
    buildLeaveMap({ employeeId: employee._id, monthStartUtc, nextMonthStartUtc }),
  ]);

  const totalScheduledDays = workingDates.length;

  let present = 0;
  let absences = 0;
  let leaves = 0;
  let paidLeaves = 0;
  let unpaidLeaves = 0;
  let halfDay = 0;
  let late = 0;

  const salarySegmentsMap = new Map();
  const lateDayBasicRates = [];

  let basicSalaryAmount = 0;
  let allowanceAmount = 0;

  for (const date of workingDates) {
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
      salaryHistory.map((entry) => ({ ...entry, effectiveDate: new Date(entry.effectiveDate) })),
      date
    );

    const policyId = getPolicyIdFromHistory(
      employee,
      assignmentHistory.map((entry) => ({ ...entry, effectiveDate: new Date(entry.effectiveDate) })),
      date
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

    const payableFactor = dayState.payableFactor;

    basicSalaryAmount += basicPerDay * payableFactor;
    allowanceAmount += allowancePerDay * payableFactor;

    if (dayState.type === "late") {
      lateDayBasicRates.push(basicPerDay);
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

  const latePenaltyAmount = calculateLatePenalty(lateDayBasicRates);
  const grossSalary = round2(basicSalaryAmount + allowanceAmount);

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
    ? await PayrollArrearsLedger.find({ employee: employee._id, settled: false })
      .session(session)
        .sort({ sourceYear: 1, sourceMonth: 1 })
        .lean()
    : [];

  const arrearsAmount = round2(
    unsettledArrearsEntries
      .filter((entry) => isEarlierMonth(entry.sourceYear, entry.sourceMonth, year, month))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  );

  const totalSalary = round2(grossSalary - latePenaltyAmount + arrearsAmount);

  const monthEndDate = new Date(nextMonthStartUtc);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1);

  const monthEndPolicyId = getPolicyIdFromHistory(
    employee,
    assignmentHistory.map((entry) => ({ ...entry, effectiveDate: new Date(entry.effectiveDate) })),
    monthEndDate
  );
  const monthEndPolicy = monthEndPolicyId ? policiesMap.get(monthEndPolicyId) : null;
  const monthEndComponents = getPolicyComponentsForDate({
    policy: monthEndPolicy,
    amountHistory: amountHistoryMap.get(monthEndPolicyId) || [],
    date: monthEndDate,
  }).components;

  const allowanceBreakdown = getAllowanceBreakdown(monthEndPolicy, monthEndComponents);

  return {
    employee: employee._id,
    employeeSnapshot: {
      employeeID: employee.employeeID,
      fullName: employee.fullName,
      joiningDate: employee.joiningDate || null,
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
      basicSalaryAmount: round2(basicSalaryAmount),
      allowanceAmount: round2(allowanceAmount),
      latePenaltyAmount,
      arrearsAmount,
      totalSalary,
    },
    allowanceBreakdown,
    arrearsLedgerEntries: unsettledArrearsEntries
      .filter((entry) => isEarlierMonth(entry.sourceYear, entry.sourceMonth, year, month))
      .map((entry) => entry._id),
    generatedBy,
    generatedAt: new Date(),
    generationMode: mode,
  };
};

export const settleArrearsForPayroll = async ({ payrollId, arrearsLedgerEntryIds = [], session = null }) => {
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
    { session }
  );
};

export const rollbackArrearsSettledByPayroll = async (payrollId, session = null) => {
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
    { session }
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

  for (const payroll of previousPayrolls) {
    const existingLedger = await PayrollArrearsLedger.findOne({
      employee: employee._id,
      sourceYear: payroll.year,
      sourceMonth: payroll.month,
    }).session(session);

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
      Number(recomputed.calculations.grossSalary || 0) - Number(recomputed.calculations.latePenaltyAmount || 0)
    );

    const existingWithoutArrears = round2(
      Number(payroll.calculations?.grossSalary || 0) - Number(payroll.calculations?.latePenaltyAmount || 0)
    );

    const diff = round2(expectedWithoutArrears - existingWithoutArrears);

    if (Math.abs(diff) < 0.01) {
      if (existingLedger && !existingLedger.settled) {
        await PayrollArrearsLedger.deleteOne({ _id: existingLedger._id }, { session });
      }
      continue;
    }

    if (existingLedger) {
      existingLedger.amount = diff;
      existingLedger.reason = "Backdated effective date adjustment";
      existingLedger.createdBy = generatedBy || existingLedger.createdBy;
      existingLedger.$session(session);
      await existingLedger.save();
    } else {
      await PayrollArrearsLedger.create([{
        employee: employee._id,
        sourceYear: payroll.year,
        sourceMonth: payroll.month,
        amount: diff,
        reason: "Backdated effective date adjustment",
        createdBy: generatedBy || null,
      }], { session });
    }
  }
};
