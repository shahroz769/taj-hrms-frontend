import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  uploadCnicImages,
  handleMulterError,
} from "../middleware/uploadMiddleware.js";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  changeEmployeeStatus,
  changeEmployeePosition,
  getEmployeePositionHistory,
  getEmployeesList,
  renewEmployeeLeaveBalances,
  renewAllEmployeesLeaveBalances,
  getEmployeeLeaveBalances,
} from "../controllers/employeeController.js";

const router = express.Router();

// @route           GET /api/employees
// @description     Get all employees (paginated)
// @access          Admin
router.get("/", protect, authorize(ROLES.admin), getAllEmployees);

// @route           GET /api/employees/list
// @description     Get employees list for dropdowns
// @access          Admin
router.get("/list", protect, authorize(ROLES.admin), getEmployeesList);

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
// @access          Admin
router.get("/:id", protect, authorize(ROLES.admin), getEmployeeById);

// @route           POST /api/employees
// @description     Create new employee
// @access          Admin only
router.post(
  "/",
  protect,
  authorize(ROLES.admin),
  uploadCnicImages,
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
  uploadCnicImages,
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
// @access          Admin
router.get(
  "/:id/position-history",
  protect,
  authorize(ROLES.admin),
  getEmployeePositionHistory
);

// @route           GET /api/employees/:id/leave-balances
// @description     Get employee leave balances (with optional year query param)
// @access          Admin
router.get(
  "/:id/leave-balances",
  protect,
  authorize(ROLES.admin),
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

export default router;
