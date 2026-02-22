import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  assignShiftToEmployees,
  getEmployeeCurrentShift,
  getEmployeeShiftHistory,
  getEmployeesByShift,
  getShiftsList,
} from "../controllers/employeeShiftController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/employee-shifts/shifts-list
// @description     Get all approved shifts for dropdown
// @access          Admin, Supervisor
router.get(
  "/shifts-list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getShiftsList,
);

// @route           POST /api/employee-shifts/assign
// @description     Bulk assign shift to employees
// @access          Admin
router.post("/assign", protect, authorize(ROLES.admin), assignShiftToEmployees);

// @route           GET /api/employee-shifts/employee/:id/current
// @description     Get current shift for an employee
// @access          Admin, Supervisor
router.get(
  "/employee/:id/current",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeCurrentShift,
);

// @route           GET /api/employee-shifts/employee/:id/history
// @description     Get shift history for an employee
// @access          Admin, Supervisor
router.get(
  "/employee/:id/history",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeShiftHistory,
);

// @route           GET /api/employee-shifts/shift/:id/employees
// @description     Get all employees on a specific shift
// @access          Admin, Supervisor
router.get(
  "/shift/:id/employees",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeesByShift,
);

export default router;
