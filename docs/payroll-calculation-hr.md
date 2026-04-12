## Purpose

This note explains the payroll calculation currently used in the HRMS payroll module.

## 1. Gross Salary

For payroll, the employee's monthly gross salary is:

`Gross Salary = Basic Salary + All Approved Allowances`

This is the starting amount before any deductions.

## 2. Per Day Salary

Per day salary is calculated using the total calendar days in the month:

`Per Day Salary = Gross Salary / Number of Calendar Days in the Month`

Examples:

- April = divide by `30`
- May = divide by `31`
- February = divide by `28` or `29`

## 3. Attendance Deductions

Attendance deductions are calculated from gross salary using per day salary.

- `Absent` = deduct `1` full per-day salary
- `Unpaid Leave` = deduct `1` full per-day salary
- `Half Day` = deduct `0.5` per-day salary

Notes:

- Paid leave does not reduce salary
- Late marks are not deducted in this payroll method

## 4. Deduction Sequence

Payroll is processed in the following order:

1. Start with `Gross Salary`
2. Deduct attendance impact:
   `Absent`, `Unpaid Leave`, `Half Day`
3. Add `Arrears`, if any
4. Process `Manual Deductions`
5. Process `Loan / Advance Repayment`
6. Remaining amount becomes `Net Salary`

## 5. Manual Deductions

Manual deductions have two statuses:

- `Pending`
- `Deducted`

Rules:

- Manual deductions are checked before loan repayment
- A manual deduction must be deducted in full
- Manual deductions are never partially cut
- If deducting a manual deduction would make salary negative, that deduction is not applied in the current month
- In that case, it remains `Pending` and is moved to the next month
- Pending manual deductions continue to roll forward until a month has enough salary to deduct them fully

## 6. Loan / Advance Repayment

Loan repayment is applied after manual deductions.

Rules:

- If the full loan installment can be deducted, it is deducted
- If the full installment cannot be deducted, the system deducts whatever salary is still available
- Loan repayment can therefore be partial
- If salary becomes zero, the remaining unpaid loan balance continues to the next month according to the repayment plan

In short:

- Manual deductions = full only
- Loan repayment = full or partial

## 7. Net Salary Formula

`Net Salary = Gross Salary - Attendance Deductions + Arrears - Deducted Manual Deductions - Loan/Advance Deduction`

## 8. Example A: Manual Deduction Fits

If an employee has:

- Basic Salary = `PKR 30,000`
- Allowances = `PKR 15,000`
- Month = `30` days
- Attendance = `1 absent`, `1 unpaid leave`, `1 half day`
- Arrears = `PKR 1,500`
- Manual deduction = `PKR 2,000`
- Loan repayment due = `PKR 3,000`

Then:

- Gross Salary = `45,000`
- Per Day Salary = `45,000 / 30 = 1,500`
- Attendance Deduction = `1,500 + 1,500 + 750 = 3,750`
- Salary after attendance and arrears = `45,000 - 3,750 + 1,500 = 42,750`
- Manual deduction = `2,000` deducted in full
- Remaining salary = `40,750`
- Loan deduction = `3,000`
- Net Salary = `37,750`

## 9. Example B: Manual Deduction Does Not Fit

If salary available before manual deductions is `PKR 3,000` and a manual deduction is `PKR 4,000`:

- The manual deduction is not partially deducted
- It stays `Pending`
- It moves to the next month
- Current month salary remains available for loan deduction or final net salary

## 10. Example C: Loan Repayment Does Not Fit

If salary available after attendance and manual deductions is `PKR 2,500` and loan repayment due is `PKR 6,000`:

- System deducts `PKR 2,500`
- Net salary becomes `PKR 0`
- Remaining unpaid loan balance continues to the next month

## 11. What HR Will See

- Payslips show `Gross Salary`
- Payslips show `Per Day Salary`
- Attendance deduction breakdown is shown separately
- Only manual deductions actually deducted in that payslip are counted as deducted
- Manual deductions that could not be cut stay pending for a future month
- The deductions screen shows manual deduction status

## 12. Summary

1. `Basic + Allowances` creates gross salary
2. Gross salary is divided by calendar days for per-day salary
3. Attendance deductions are applied first
4. Arrears are added
5. Manual deductions are checked next and must be full
6. Loan repayment is checked after that and may be partial
7. Remaining balance is the final net salary
