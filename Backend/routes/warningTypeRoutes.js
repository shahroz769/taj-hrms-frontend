import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createWarningType,
  deleteWarningType,
  getAllWarningTypes,
  getAllWarningTypesList,
  updateWarningType,
  updateWarningTypeStatus,
} from "../controllers/warningTypeController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/warning-types
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllWarningTypes,
);

// @route           GET /api/warning-types/list
router.get(
  "/list",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllWarningTypesList,
);

// @route           POST /api/warning-types
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createWarningType,
);

// @route           PUT /api/warning-types/:id
router.put("/:id", protect, authorize(ROLES.admin), updateWarningType);

// @route           PATCH /api/warning-types/:id/status
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  updateWarningTypeStatus,
);

// @route           DELETE /api/warning-types/:id
router.delete("/:id", protect, authorize(ROLES.admin), deleteWarningType);

export default router;
