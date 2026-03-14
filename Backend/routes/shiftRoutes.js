import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createShift,
  getAllShifts,
  updateShift,
  deleteShift,
  updateShiftStatus,
  // getShiftById,
  // getAllShiftsFiltersList,
} from "../controllers/shiftController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/shifts
// @description     Get all shifts
// @access          Admin, Supervisor
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllShifts
);

// @route           POST /api/shifts
// @description     Create new shift
// @access          Admin, Supervisor
router.post(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  createShift
);

// @route           PUT /api/shifts/:id
// @description     Update shift
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateShift);

// @route           PATCH /api/shifts/:id/status
// @description     Update shift status (Approve/Reject)
// @access          Admin only
router.patch("/:id/status", protect, authorize(ROLES.admin), updateShiftStatus);

// @route           DELETE /api/shifts/:id
// @description     Delete shift
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteShift);

export default router;
