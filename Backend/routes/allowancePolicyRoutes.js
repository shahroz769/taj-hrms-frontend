import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createAllowancePolicy,
  getAllAllowancePolicies,
  getAllAllowancePoliciesList,
  getAllowancePolicyById,
  updateAllowancePolicy,
  updateAllowancePolicyStatus,
  deleteAllowancePolicy,
} from "../controllers/allowancePolicyController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/allowance-policies
// @description     Get all allowance policies
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllAllowancePolicies
);

// @route           GET /api/allowance-policies/list
// @description     Get all allowance policies list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllAllowancePoliciesList
);

// @route           GET /api/allowance-policies/:id
// @description     Get single allowance policy by ID
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllowancePolicyById
);

// @route           POST /api/allowance-policies
// @description     Create new allowance policy
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createAllowancePolicy
);

// @route           PUT /api/allowance-policies/:id
// @description     Update allowance policy
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateAllowancePolicy);

// @route           PATCH /api/allowance-policies/:id/status
// @description     Update allowance policy status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateAllowancePolicyStatus
);

// @route           DELETE /api/allowance-policies/:id
// @description     Delete allowance policy
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteAllowancePolicy);

export default router;
