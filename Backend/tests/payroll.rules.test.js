import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAttendanceDeductionFromCounts,
  calculateManualDeductionPlan,
  calculateLoanDeductionForPayroll,
  getCalendarDaysInMonth,
} from "../services/payrollCalculationUtils.js";

test("per-day salary uses calendar days of the month", () => {
  assert.equal(getCalendarDaysInMonth(2024, 2), 29);
  assert.equal(getCalendarDaysInMonth(2026, 4), 30);
});

test("attendance deduction is based on total salary divided by calendar days", () => {
  const result = calculateAttendanceDeductionFromCounts({
    basicSalaryMonthly: 30000,
    allowanceMonthly: 15000,
    calendarDaysInMonth: 30,
    absences: 1,
    unpaidLeaves: 1,
    halfDays: 1,
  });

  assert.equal(result.basicDeductionAmount, 2500);
  assert.equal(result.allowanceDeductionAmount, 1250);
  assert.equal(result.totalDeductionAmount, 3750);
  assert.equal(result.deductionDayUnits, 2.5);
  assert.deepEqual(
    result.breakdown.map((item) => ({
      key: item.key,
      totalAmount: item.totalAmount,
    })),
    [
      { key: "absent", totalAmount: 1500 },
      { key: "unpaidLeave", totalAmount: 1500 },
      { key: "halfDay", totalAmount: 750 },
    ],
  );
});

test("fixed loan deduction is capped by available salary", () => {
  const result = calculateLoanDeductionForPayroll({
    activeLoan: {
      _id: "loan-1",
      repaymentType: "fixed_amount",
      remainingBalance: 10000,
      repaymentSchedule: [
        { year: 2026, month: 4, amount: 5000, status: "Pending" },
      ],
    },
    year: 2026,
    month: 4,
    salaryAvailable: 3200,
  });

  assert.equal(result.loanDeductionAmount, 3200);
  assert.equal(result.loanDeductionBreakdown[0].remainingBalance, 6800);
});

test("manual deductions are only deducted when they fully fit", () => {
  const result = calculateManualDeductionPlan({
    deductions: [
      {
        _id: "ded-1",
        amount: 2000,
        reason: "Mess deduction",
        currentDueYear: 2026,
        currentDueMonth: 4,
      },
      {
        _id: "ded-2",
        amount: 4000,
        reason: "Uniform deduction",
        currentDueYear: 2026,
        currentDueMonth: 4,
      },
    ],
    salaryAvailable: 5000,
    payrollYear: 2026,
    payrollMonth: 4,
  });

  assert.equal(result.deductedAmount, 2000);
  assert.equal(result.remainingSalary, 3000);
  assert.deepEqual(
    result.breakdown.map((item) => ({
      deduction: item.deduction,
      status: item.status,
      deferredToYear: item.deferredToYear || null,
      deferredToMonth: item.deferredToMonth || null,
    })),
    [
      {
        deduction: "ded-1",
        status: "deducted",
        deferredToYear: null,
        deferredToMonth: null,
      },
      {
        deduction: "ded-2",
        status: "pending",
        deferredToYear: 2026,
        deferredToMonth: 5,
      },
    ],
  );
});

test("next salary loan deduction can recover only available salary", () => {
  const result = calculateLoanDeductionForPayroll({
    activeLoan: {
      _id: "loan-2",
      repaymentType: "next_salary",
      remainingBalance: 7000,
      repaymentSchedule: [
        { year: 2026, month: 4, amount: 7000, status: "Pending" },
      ],
    },
    year: 2026,
    month: 4,
    salaryAvailable: 5000,
  });

  assert.equal(result.loanDeductionAmount, 5000);
  assert.equal(result.loanDeductionBreakdown[0].remainingBalance, 2000);
});
