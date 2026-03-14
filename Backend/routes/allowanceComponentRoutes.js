import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createAllowanceComponent,
  getAllAllowanceComponents,
  getAllAllowanceComponentsList,
  getAllowanceComponentById,
  updateAllowanceComponent,
  updateAllowanceComponentStatus,
  deleteAllowanceComponent,
} from "../controllers/allowanceComponentController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/allowance-components
// @description     Get all allowance components
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllAllowanceComponents
);

// @route           GET /api/allowance-components/list
// @description     Get all allowance components list for select options
// @access          Admin, Supervisor
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllAllowanceComponentsList
);

// @route           GET /api/allowance-components/:id
// @description     Get single allowance component by ID
// @access          Admin, Supervisor
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllowanceComponentById
);

// @route           POST /api/allowance-components
// @description     Create new allowance component
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createAllowanceComponent
);

// @route           PUT /api/allowance-components/:id
// @description     Update allowance component
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateAllowanceComponent);

// @route           PATCH /api/allowance-components/:id/status
// @description     Update allowance component status (Approve/Reject)
// @access          Admin only
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateAllowanceComponentStatus
);

// @route           DELETE /api/allowance-components/:id
// @description     Delete allowance component
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteAllowanceComponent);

export default router;
