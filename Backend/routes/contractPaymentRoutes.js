import express from "express";
import {
  createPayment,
  getPaymentsByContract,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from "../controllers/contractPaymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

/**
 * @route   POST /api/contract-payments
 * @desc    Create a new payment record
 * @access  Admin
 */
router.post("/", protect, authorize(ROLES.admin), createPayment);

/**
 * @route   GET /api/contract-payments/summary/:contractId
 * @desc    Get payment summary for a contract
 * @access  Admin
 */
router.get(
  "/summary/:contractId",
  protect,
  authorize(ROLES.admin),
  getPaymentSummary
);

/**
 * @route   GET /api/contract-payments/contract/:contractId
 * @desc    Get all payment records for a specific contract
 * @access  Admin
 */
router.get(
  "/contract/:contractId",
  protect,
  authorize(ROLES.admin),
  getPaymentsByContract
);

/**
 * @route   GET /api/contract-payments/:id
 * @desc    Get payment by ID
 * @access  Admin
 */
router.get("/:id", protect, authorize(ROLES.admin), getPaymentById);

/**
 * @route   PUT /api/contract-payments/:id
 * @desc    Update payment record
 * @access  Admin
 */
router.put("/:id", protect, authorize(ROLES.admin), updatePayment);

/**
 * @route   DELETE /api/contract-payments/:id
 * @desc    Delete payment record
 * @access  Admin
 */
router.delete("/:id", protect, authorize(ROLES.admin), deletePayment);

export default router;
