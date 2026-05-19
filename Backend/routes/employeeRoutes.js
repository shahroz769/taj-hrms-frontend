import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  uploadEmployeeImages,
  handleMulterError,
} from "../middleware/uploadMiddleware.js";
import {
  createEmployee,
  getNextEmployeeId,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  changeEmployeeStatus,
  changeEmployeePosition,
  getEmployeePositionHistory,
  getEmployeeCompensationHistory,
  getEmployeesList,
  renewEmployeeLeaveBalances,
  renewAllEmployeesLeaveBalances,
  getEmployeeLeaveBalances,
  endEmployment,
  rejoinEmployee,
  getEmployeePayrolls,
  getEmployeeLeaveApplications,
} from "../controllers/employeeController.js";

const router = express.Router();

// @route           GET /api/employees
// @description     Get all employees (paginated)
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllEmployees,
);

// @route           GET /api/employees/list
// @description     Get employees list for dropdowns
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeesList,
);

router.get(
  "/next-id",
  protect,
  authorize(ROLES.admin),
  getNextEmployeeId,
);

// @route           POST /api/employees/renew-all-leave-balances
// @description     Bulk renew leave balances for all active employees
// @access          Admin
router.post(
  "/renew-all-leave-balances",
  protect,
  authorize(ROLES.admin),
  renewAllEmployeesLeaveBalances
);

// @route           GET /api/employees/:id
// @description     Get single employee
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeById,
);

// @route           POST /api/employees
// @description     Create new employee
// @access          Admin only
router.post(
  "/",
  protect,
  authorize(ROLES.admin),
  uploadEmployeeImages,
  handleMulterError,
  createEmployee
);

// @route           PUT /api/employees/:id
// @description     Update employee
// @access          Admin only
router.put(
  "/:id",
  protect,
  authorize(ROLES.admin),
  uploadEmployeeImages,
  handleMulterError,
  updateEmployee
);

// @route           PATCH /api/employees/:id/status
// @description     Change employee status
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  changeEmployeeStatus
);

// @route           PATCH /api/employees/:id/position
// @description     Change employee position (also handles leave balance adjustments)
// @access          Admin only
router.patch(
  "/:id/position",
  protect,
  authorize(ROLES.admin),
  changeEmployeePosition
);

// @route           GET /api/employees/:id/position-history
// @description     Get employee position history
// @access          Admin, Supervisor
router.get(
  "/:id/position-history",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeePositionHistory
);

// @route           GET /api/employees/:id/compensation-history
// @description     Get employee compensation history (salary + allowances)
// @access          Admin, Supervisor
router.get(
  "/:id/compensation-history",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeCompensationHistory
);

// @route           GET /api/employees/:id/leave-balances
// @description     Get employee leave balances (with optional year query param)
// @access          Admin, Supervisor
router.get(
  "/:id/leave-balances",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeLeaveBalances
);

// @route           POST /api/employees/:id/renew-leave-balances
// @description     Renew leave balances for a single employee for new year
// @access          Admin
router.post(
  "/:id/renew-leave-balances",
  protect,
  authorize(ROLES.admin),
  renewEmployeeLeaveBalances
);

// @route           POST /api/employees/:id/end-employment
// @description     Terminate or resign an employee with effective date and reason
// @access          Admin only
router.post(
  "/:id/end-employment",
  protect,
  authorize(ROLES.admin),
  endEmployment,
);

// @route           POST /api/employees/:id/rejoin
// @description     Rejoin a previously ended employee
// @access          Admin only
router.post(
  "/:id/rejoin",
  protect,
  authorize(ROLES.admin),
  rejoinEmployee,
);

// @route           GET /api/employees/:id/payrolls
// @description     Get payroll list for a single employee
// @access          Admin, Supervisor
router.get(
  "/:id/payrolls",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeePayrolls,
);

// @route           GET /api/employees/:id/leave-applications
// @description     Get leave applications for a single employee
// @access          Admin, Supervisor
router.get(
  "/:id/leave-applications",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeLeaveApplications,
);

export default router;
