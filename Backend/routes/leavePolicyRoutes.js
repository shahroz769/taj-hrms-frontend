import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createLeavePolicy,
  getAllLeavePolicies,
  getAllLeavePoliciesList,
  getLeavePolicyById,
  updateLeavePolicy,
  updateLeavePolicyStatus,
  deleteLeavePolicy,
} from "../controllers/leavePolicyController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/leave-policies
// @description     Get all leave policies
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllLeavePolicies
);

// @route           GET /api/leave-policies/list
// @description     Get all leave policies list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllLeavePoliciesList
);

// @route           GET /api/leave-policies/:id
// @description     Get single leave policy by ID
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getLeavePolicyById
);

// @route           POST /api/leave-policies
// @description     Create new leave policy
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createLeavePolicy
);

// @route           PUT /api/leave-policies/:id
// @description     Update leave policy
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateLeavePolicy);

// @route           PATCH /api/leave-policies/:id/status
// @description     Update leave policy status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateLeavePolicyStatus
);

// @route           DELETE /api/leave-policies/:id
// @description     Delete leave policy
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteLeavePolicy);

export default router;
