import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  bulkMarkAttendance,
  getMonthlyAttendance,
  getEmployeeMonthlyAttendance,
  updateAttendance,
  markSingleAttendance,
  deleteAttendance,
  getEmployeeMonthlySummary,
} from "../controllers/attendanceController.js";

const router = express.Router();

// @route           POST /api/attendances/bulk-mark
// @description     Bulk mark attendance for multiple employees
// @access          Admin
router.post(
  "/bulk-mark",
  protect,
  authorize(ROLES.admin),
  bulkMarkAttendance,
);

// @route           GET /api/attendances/monthly
// @description     Get monthly attendance grid
// @access          Admin, Supervisor
router.get(
  "/monthly",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getMonthlyAttendance,
);

// @route           POST /api/attendances/mark-single
// @description     Create a single attendance record (cell edit on empty cell)
// @access          Admin
router.post(
  "/mark-single",
  protect,
  authorize(ROLES.admin),
  markSingleAttendance,
);

// @route           GET /api/attendances/summary/:employeeId
// @description     Get monthly summary for an employee (for payroll)
// @access          Admin
router.get(
  "/summary/:employeeId",
  protect,
  authorize(ROLES.admin),
  getEmployeeMonthlySummary,
);

// @route           GET /api/attendances/employee/:id
// @description     Get a single employee's monthly attendance
// @access          Admin, Supervisor
router.get(
  "/employee/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeMonthlyAttendance,
);

// @route           PUT /api/attendances/:id
// @description     Update a single attendance record (cell edit)
// @access          Admin
router.put("/:id", protect, authorize(ROLES.admin), updateAttendance);

// @route           DELETE /api/attendances/:id
// @description     Delete a single attendance record
// @access          Admin
router.delete("/:id", protect, authorize(ROLES.admin), deleteAttendance);

export default router;
