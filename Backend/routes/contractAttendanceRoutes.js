import express from "express";
import {
  createAttendance,
  getAttendancesByContract,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
} from "../controllers/contractAttendanceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

/**
 * @route   POST /api/contract-attendances
 * @desc    Create a new attendance record
 * @access  Admin
 */
router.post("/", protect, authorize(ROLES.admin), createAttendance);

/**
 * @route   GET /api/contract-attendances/contract/:contractId
 * @desc    Get all attendance records for a specific contract
 * @access  Admin
 */
router.get(
  "/contract/:contractId",
  protect,
  authorize(ROLES.admin),
  getAttendancesByContract
);

/**
 * @route   GET /api/contract-attendances/:id
 * @desc    Get attendance by ID
 * @access  Admin
 */
router.get("/:id", protect, authorize(ROLES.admin), getAttendanceById);

/**
 * @route   PUT /api/contract-attendances/:id
 * @desc    Update attendance record
 * @access  Admin
 */
router.put("/:id", protect, authorize(ROLES.admin), updateAttendance);

/**
 * @route   DELETE /api/contract-attendances/:id
 * @desc    Delete attendance record
 * @access  Admin
 */
router.delete("/:id", protect, authorize(ROLES.admin), deleteAttendance);

export default router;
