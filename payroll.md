## Plan: Production Payroll Module with Mid-Month Proration

Build a full payroll module across frontend and backend that supports bulk generation, per-employee regeneration, payslip PDF, strict month-close validation (Pakistan timezone), and day-level proration for mid-month salary/allowance changes. Past generated payrolls remain immutable; backdated effective-date changes are compensated through arrears posted in a future payroll cycle. Reuse existing employee listing and month/year filter patterns, extend employee change-history infrastructure for salary + allowance value timelines, and enforce idempotent generation with optional force replace.

**Steps**
1. Phase 1 — Domain model and API contract finalization
   1. Define payroll API contracts (list, generate bulk, regenerate single, payslip view/download) with request/response schemas aligned to existing API style and frontend pagination/filter conventions.
   - Generation response must include structured partial-failure payload: employeeId, employeeName, month, year, reasonCode, reasonMessage.
   2. Define calculation primitives and constants in backend payroll service: day divisor source = shift-based scheduled working days, half-day salary = 50%, absent/unpaid leave = 0 pay, paid leave = full pay, late penalty = 0.5 day deduction per each 3 lates (cumulative).
   3. Define persistence approach for "overwrite + audit trail" regeneration and force replace behavior (default OFF toggle).
   4. Lock timezone policy: backend must enforce Asia/Karachi month boundaries explicitly using timezone library (e.g., date-fns-tz), not native Date-only comparisons.
   5. Lock document architecture: payslip PDF generation is backend-owned (Node service), frontend only triggers preview/download.

2. Phase 2 — Historical tracking for mid-month salary/allowance (blocks payroll correctness)
   1. Add `BasicSalaryHistory` model with employee, fromBasicSalary, toBasicSalary, effectiveDate, changedBy, reason, changedAt; index by employee+effectiveDate.
   2. Fix/extend allowance history to support amount-level changes, not only policy-assignment changes:
      - Track assignment changes with effectiveDate.
      - Track policy amount changes with effectiveDate impact on assigned employees (snapshot-driven history entries).
   3. Extend employee update flow to require explicit effective date when basic salary or allowance policy changes.
   4. Extend allowance policy update flow to require effective date and generate history entries for impacted employees when policy component amounts change.
   5. Add history retrieval endpoints for payroll engine and optional admin diagnostics.

3. Phase 3 — Payroll backend implementation
   1. Create `Payroll` model with unique key (employee, year, month), payroll snapshots, attendance breakdown, salary segments, totals, status fields, audit metadata, and regeneration metadata.
   2. Build payroll calculation service that:
      - Selects employees active at any time during selected month (including resigned/inactive later).
      - Splits selected month into contiguous date segments by salary/allowance effective dates.
      - Computes payable days per segment from attendance + leave + late penalties.
      - Applies rules: allowances full unless day unpaid/absent; half-day = 50%; paid leave full; unpaid leave zero; late penalty cumulative by month.
      - Handles missing attendance records: count as absent for scheduled working day.
   3. Add month-completion validation guard (selected month must be fully elapsed in GMT+5).
   4. Add duplicate/existing protection:
      - Normal mode: skip existing and return counts.
      - Force mode: replace existing payrolls for active-in-month employees and record overwrite audit.
      - Force mode must be transactional with arrears settlement rollback: before overwrite, mark arrears settled by that payroll as unsettled, then regenerate payroll and re-settle against the new payroll snapshot.
   5. Add endpoints:
      - List payrolls with filters: search employee, month/year, department, position, pagination.
      - Generate payroll for month/year (bulk).
      - Regenerate single employee payroll for month/year.
      - Get payslip detail payload.
      - For bulk generation, return success summary + per-employee error list (for non-fatal/partial failures).
   6. Add arrears engine:
      - Detect backdated salary/allowance history entries whose effective dates are earlier than already-generated payroll months.
      - Compute month/date-segment salary deltas without mutating historical payroll rows/payslips.
      - Store arrears ledger entries with source month(s), amount, reason, createdBy, settlement status, settledByPayrollId, and settledAt.
      - Auto-post arrears to the first payroll generated after the backdated change.
      - If employee is inactive/resigned at posting time, generate final arrears-only payroll.
      - Arrears posting/settlement must be idempotent and safe under retries and force-replace flows.
   7. Add robust transactional handling (session/transaction where feasible) and deterministic rounding policy.
   8. Hardcode daily precedence before monthly aggregation: Leave/Off lock > Half Day > Late penalty.

4. Phase 4 — Frontend navigation and payroll UX
   1. Rename sidebar section label from "Allowances" to "Salary" and include existing allowance pages under this section.
   2. Add "Payroll" child route under salary section and wire route/page registration.
   3. Build payroll list page following employee-list pattern:
      - Data table columns: year, month, total working days, present, absences, leaves, half day, late, paid leaves, unpaid leaves, gross salary, total salary, salary slip action, regenerate action.
      - Search, department/position filters, month-year selectors, pagination.
      - Query param sync + debounced search.
   4. Build Generate Payroll dialog:
      - Year dropdown, month dropdown, active-in-month employee count preview.
      - Force replace toggle.
      - Server validation messages surfaced clearly.
      - On generation errors, open modal with scrollable error list; each row shows employee, month/year, and reason.
      - Modal body is vertically scrollable and each error item supports long-text scrolling/wrapping for detailed reasons.
   5. Build per-row Regenerate action with confirmation dialog and refresh semantics.
   6. Build payslip view dialog/page:
      - Top-left: employee name, position, department.
      - Top-right: month/year, employee id, joining date.
      - Separator.
      - Salary breakdown: gross salary, basic salary, allowance lines, deductions.
      - Download PDF button (MVP layout, no branding) that calls backend-generated PDF endpoint.

5. Phase 5 — Employee/allowance change UI support for effective dates
   1. Update employee edit form to capture effective date + reason for basic salary and allowance policy changes.
   2. Update allowance policy edit flow to capture effective date for component amount changes and process impacted employees.
   3. Add validations to prevent invalid effective-date overlaps and ambiguous history intervals.

6. Phase 6 — Verification and release safety (production readiness)
   1. Unit/integration tests (backend):
      - Month-close guard in GMT+5.
      - Missing attendance treated as absent.
      - Late penalty ladder (3, 4, 6, 9 lates).
      - Half-day + late same date => only half-day effect.
      - Paid vs unpaid leave split.
      - Mid-month salary change segment math.
      - Mid-month allowance change (assignment + policy amount edit) segment math.
      - Active-anytime-in-month eligibility + proration for resigned mid-month.
      - Arrears computation for backdated effective dates across prior generated months.
      - Immutability of historical payroll rows/payslips after arrears posting.
      - Arrears-only payroll generation for inactive/resigned employees.
      - Arrears settlement rollback/re-settlement correctness during force replace of same payroll month.
      - PKT boundary checks around UTC crossover using explicit Asia/Karachi conversion.
      - Daily precedence correctness: Leave/Off > Half Day > Late penalty.
      - Idempotent generate, force replace overwrite audit, single-row regenerate.
   2. Frontend behavior tests/manual QA:
      - Sidebar rename + payroll navigation.
      - Filters, pagination, search, month/year selector behavior and URL sync.
      - Generate dialog counts, force toggle, and API error states.
      - Generation error modal: scroll behavior, long error text rendering, and accurate employee month/year reason mapping.
      - Payslip rendering + PDF download.
   3. Pre-production data validation scripts:
      - Detect employees missing shift assignment during month.
      - Detect malformed salary/allowance history intervals.
      - Detect payroll rows with negative totals or mismatched breakdown sums.
   4. Rollout safety:
      - Feature flag payroll generation UI until backend migration completes.
      - Backfill script for initial salary history baseline from current employee data.

**Relevant files**
- `src/components/Sidebar/sidebarConfig.js` — rename Allowances section to Salary and add Payroll child item.
- `src/App.jsx` — add payroll routes under protected layout.
- `src/pages/Workforce/AllEmployees.jsx` — reuse list/filter/pagination/table architecture.
- `src/pages/Compliance/EmployeeProgressReports.jsx` — reuse month/year selector pattern.
- `src/services/employeesApi.js` — reference API conventions for service layer additions.
- `src/pages/Workforce/EditEmployee.jsx` — add effective-date/reason capture for salary/allowance changes.
- `Backend/models/Employee.js` — current basic salary source field.
- `Backend/models/AllowancePolicyHistory.js` — extend/fix indexing and history usage.
- `Backend/controllers/employeeController.js` — inject effective-date-based history writes.
- `Backend/controllers/allowancePolicyController.js` — add effective-date history propagation on amount edits.
- `Backend/controllers/attendanceController.js` — reuse shift-working-days + attendance rules.
- `Backend/models/MonthlyAttendanceSummary.js` — reuse monthly counts and closure checks.
- `Backend/routes/employeeRoutes.js` — extend history endpoints if needed.
- New backend files: payroll model/controller/routes/service, salary-history model, arrears ledger + settlement utilities, timezone utility (Asia/Karachi), server-side payslip PDF service, migration/backfill scripts.
- New frontend files: payroll page + API service + payslip component/PDF utility.

**Verification**
1. Backend automated tests for payroll formula and edge cases listed in Phase 6.
2. API contract tests for list/generate/regenerate/payslip endpoints with force/non-force modes.
3. Manual QA with seeded scenarios:
   - No attendance entries.
   - Mid-month raise in basic salary.
   - Mid-month allowance increase by policy assignment.
   - Mid-month allowance amount update in existing policy.
   - Resigned employee with attendance only first week.
4. Month boundary tests around Pakistan midnight crossing.
5. PDF validation for payslip content and download behavior.
6. Regression checks for existing allowance and employee edit workflows.

**Decisions**
- Included scope:
  - Payroll generation for employees active at any time in selected month.
  - Force replace toggle in generation dialog (default OFF).
  - Per-row regenerate for month/year/employee.
  - Snapshot payroll records (basic salary, allowances, position, department, calculated breakdown).
   - Bulk generation supports partial success with detailed per-employee error reporting.
  - Historical payroll rows remain immutable after generation.
  - Backdated salary/allowance changes create arrears entries and are settled in the first subsequent generated payroll.
  - For inactive/resigned employees, settle arrears through a final arrears-only payroll.
   - Force replace is transactional with arrears rollback and re-settlement.
   - Payslip PDF generation is backend-owned for deterministic output.
   - Month-close checks are timezone-safe using explicit Asia/Karachi conversion.
   - Attendance precedence is enforced as Leave/Off > Half Day > Late penalty.
- Excluded scope (MVP boundary):
  - Company branding/logo/signature block in payslip.
  - Advanced tax slabs/overtime engine unless already required later.

**Further Considerations**
1. Baseline history migration: create initial salary/allowance baseline entries so arrears engine can detect true deltas for older effective dates.
2. Rounding standard: confirm rounding to 2 decimals per segment vs only final total (recommend final-total rounding with internal high precision).
3. Permission model: confirm regenerate/force-generate limited to admin only (recommended).