import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllLeaveApplications,
  createLeaveApplication,
  updateLeaveApplication,
  approveLeaveApplication,
  rejectLeaveApplication,
  deleteLeaveApplication,
  getEmployeeLeaveBalance,
} from "../controllers/leaveApplicationController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route   GET /api/leave-applications
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllLeaveApplications
);

// @route   GET /api/leave-applications/balance/:employeeId
router.get(
  "/balance/:employeeId",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeLeaveBalance
);

// @route   POST /api/leave-applications
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createLeaveApplication
);

// @route   PUT /api/leave-applications/:id
router.put(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  updateLeaveApplication
);

// @route   PATCH /api/leave-applications/:id/approve
router.patch(
  "/:id/approve",
  protect,
  authorize(ROLES.admin),
  approveLeaveApplication
);

// @route   PATCH /api/leave-applications/:id/reject
router.patch(
  "/:id/reject",
  protect,
  authorize(ROLES.admin),
  rejectLeaveApplication
);

// @route   DELETE /api/leave-applications/:id
router.delete(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  deleteLeaveApplication
);

export default router;
