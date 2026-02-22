import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createDisciplinaryAction,
  deleteDisciplinaryAction,
  getAllDisciplinaryActions,
  getDisciplinaryActionById,
  toggleDisciplinaryActionStatus,
  updateDisciplinaryAction,
} from "../controllers/disciplinaryActionController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/disciplinary-actions
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllDisciplinaryActions,
);

// @route           GET /api/disciplinary-actions/:id
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getDisciplinaryActionById,
);

// @route           POST /api/disciplinary-actions
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createDisciplinaryAction,
);

// @route           PUT /api/disciplinary-actions/:id
router.put("/:id", protect, authorize(ROLES.admin), updateDisciplinaryAction);

// @route           PATCH /api/disciplinary-actions/:id/status
router.patch(
  "/:id/status",
  protect,
  authorize(ROLES.admin),
  toggleDisciplinaryActionStatus,
);

// @route           DELETE /api/disciplinary-actions/:id
router.delete(
  "/:id",
  protect,
  authorize(ROLES.admin),
  deleteDisciplinaryAction,
);

export default router;
