const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const roundMoney = (value) => Math.round(Number(value) || 0);

export const getCalendarDaysInMonth = (year, month) =>
  new Date(Number(year), Number(month), 0).getDate();

export const getNextYearMonth = (year, month) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (numericMonth === 12) {
    return { year: numericYear + 1, month: 1 };
  }

  return { year: numericYear, month: numericMonth + 1 };
};

export const calculateAttendanceDeductionFromCounts = ({
  basicSalaryMonthly = 0,
  allowanceMonthly = 0,
  calendarDaysInMonth = 1,
  absences = 0,
  unpaidLeaves = 0,
  halfDays = 0,
}) => {
  const divisor = Number(calendarDaysInMonth || 1);
  const basicPerDay = Number(basicSalaryMonthly || 0) / divisor;
  const allowancePerDay = Number(allowanceMonthly || 0) / divisor;

  const absentBasicAmount = basicPerDay * Number(absences || 0);
  const absentAllowanceAmount = allowancePerDay * Number(absences || 0);
  const unpaidLeaveBasicAmount = basicPerDay * Number(unpaidLeaves || 0);
  const unpaidLeaveAllowanceAmount =
    allowancePerDay * Number(unpaidLeaves || 0);
  const halfDayBasicAmount = basicPerDay * Number(halfDays || 0) * 0.5;
  const halfDayAllowanceAmount = allowancePerDay * Number(halfDays || 0) * 0.5;

  const breakdown = [
    {
      key: "absent",
      label: "Absent",
      count: Number(absences || 0),
      basicAmount: roundMoney(absentBasicAmount),
      allowanceAmount: roundMoney(absentAllowanceAmount),
      totalAmount: roundMoney(absentBasicAmount + absentAllowanceAmount),
    },
    {
      key: "unpaidLeave",
      label: "Unpaid Leave",
      count: Number(unpaidLeaves || 0),
      basicAmount: roundMoney(unpaidLeaveBasicAmount),
      allowanceAmount: roundMoney(unpaidLeaveAllowanceAmount),
      totalAmount: roundMoney(
        unpaidLeaveBasicAmount + unpaidLeaveAllowanceAmount,
      ),
    },
    {
      key: "halfDay",
      label: "Half Day",
      count: Number(halfDays || 0),
      basicAmount: roundMoney(halfDayBasicAmount),
      allowanceAmount: roundMoney(halfDayAllowanceAmount),
      totalAmount: roundMoney(halfDayBasicAmount + halfDayAllowanceAmount),
    },
  ].filter((item) => item.count > 0 || Math.abs(item.totalAmount) > 0.009);

  return {
    basicDeductionAmount: roundMoney(
      breakdown.reduce((sum, item) => sum + Number(item.basicAmount || 0), 0),
    ),
    allowanceDeductionAmount: roundMoney(
      breakdown.reduce(
        (sum, item) => sum + Number(item.allowanceAmount || 0),
        0,
      ),
    ),
    totalDeductionAmount: roundMoney(
      breakdown.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
    ),
    deductionDayUnits: round2(
      Number(absences || 0) +
        Number(unpaidLeaves || 0) +
        Number(halfDays || 0) * 0.5,
    ),
    breakdown,
  };
};

export const calculateLoanDeductionForPayroll = ({
  activeLoan = null,
  year,
  month,
  salaryAvailable = 0,
}) => {
  if (!activeLoan) {
    return { loanDeductionAmount: 0, loanDeductionBreakdown: [] };
  }

  const scheduleIndex = (activeLoan.repaymentSchedule || []).findIndex(
    (entry) =>
      entry.year === year &&
      entry.month === month &&
      entry.status === "Pending",
  );

  if (scheduleIndex === -1) {
    return { loanDeductionAmount: 0, loanDeductionBreakdown: [] };
  }

  const entry = activeLoan.repaymentSchedule[scheduleIndex];
  const cappedAvailable = Math.max(0, roundMoney(salaryAvailable));
  const scheduledAmount =
    activeLoan.repaymentType === "next_salary"
      ? Number(activeLoan.remainingBalance || 0)
      : Number(entry.amount || 0);
  const loanDeductionAmount = roundMoney(
    Math.min(
      Number(activeLoan.remainingBalance || 0),
      Number(scheduledAmount || 0),
      cappedAvailable,
    ),
  );

  if (loanDeductionAmount <= 0) {
    return { loanDeductionAmount: 0, loanDeductionBreakdown: [] };
  }

  const paidBefore = (activeLoan.repaymentSchedule || []).filter(
    (scheduleEntry) =>
      scheduleEntry.status === "Paid" || scheduleEntry.status === "Partial",
  ).length;

  return {
    loanDeductionAmount,
    loanDeductionBreakdown: [
      {
        loan: activeLoan._id,
        installmentAmount: loanDeductionAmount,
        installmentNumber: paidBefore + 1,
        totalInstallments: activeLoan.repaymentSchedule.length,
        remainingBalance: roundMoney(
          Number(activeLoan.remainingBalance || 0) - loanDeductionAmount,
        ),
      },
    ],
  };
};

export const calculateManualDeductionPlan = ({
  deductions = [],
  salaryAvailable = 0,
  payrollYear,
  payrollMonth,
}) => {
  const availableSalary = roundMoney(Math.max(0, Number(salaryAvailable || 0)));
  let remainingSalary = availableSalary;
  let deductedAmount = 0;
  const breakdown = [];
  const nextDue = getNextYearMonth(payrollYear, payrollMonth);

  for (const deduction of deductions) {
    const amount = roundMoney(Number(deduction.amount || 0));
    const sourceDueYear = Number(deduction.currentDueYear || payrollYear);
    const sourceDueMonth = Number(deduction.currentDueMonth || payrollMonth);

    if (amount <= remainingSalary) {
      deductedAmount += amount;
      remainingSalary = roundMoney(remainingSalary - amount);
      breakdown.push({
        deduction: deduction._id,
        reason: deduction.reason || "Manual Deduction",
        amount,
        date: deduction.date || null,
        status: "deducted",
        sourceDueYear,
        sourceDueMonth,
      });
      continue;
    }

    breakdown.push({
      deduction: deduction._id,
      reason: deduction.reason || "Manual Deduction",
      amount,
      date: deduction.date || null,
      status: "pending",
      sourceDueYear,
      sourceDueMonth,
      deferredToYear: nextDue.year,
      deferredToMonth: nextDue.month,
    });
  }

  return {
    deductedAmount: roundMoney(deductedAmount),
    remainingSalary: roundMoney(remainingSalary),
    breakdown,
  };
};
