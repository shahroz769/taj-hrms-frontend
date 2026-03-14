import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createLeaveType,
  getAllLeaveTypes,
  getAllLeaveTypesList,
  updateLeaveType,
  updateLeaveTypeStatus,
  deleteLeaveType,
} from "../controllers/leaveTypeController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/leave-types
// @description     Get all leave types
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllLeaveTypes
);

// @route           GET /api/leave-types/list
// @description     Get all leave types list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllLeaveTypesList
);

// @route           POST /api/leave-types
// @description     Create new leave type
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createLeaveType
);

// @route           PUT /api/leave-types/:id
// @description     Update leave type
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateLeaveType);

// @route           PATCH /api/leave-types/:id/status
// @description     Update leave type status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateLeaveTypeStatus
);

// @route           DELETE /api/leave-types/:id
// @description     Delete leave type
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteLeaveType);

export default router;
