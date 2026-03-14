import express from "express";
import {
  createContract,
  getAllContracts,
  getContractById,
  updateContract,
  updateContractStatus,
  deleteContract,
  getContractsList,
} from "../controllers/contractController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

/**
 * @route   GET /api/contracts/list
 * @desc    Get simple list of contracts for dropdown
 * @access  Admin
 */
router.get("/list", protect, authorize(ROLES.admin), getContractsList);

/**
 * @route   POST /api/contracts
 * @desc    Create a new contract
 * @access  Admin
 */
router.post("/", protect, authorize(ROLES.admin), createContract);

/**
 * @route   GET /api/contracts
 * @desc    Get all contracts with pagination
 * @access  Admin
 */
router.get("/", protect, authorize(ROLES.admin), getAllContracts);

/**
 * @route   GET /api/contracts/:id
 * @desc    Get contract by ID
 * @access  Admin
 */
router.get("/:id", protect, authorize(ROLES.admin), getContractById);

/**
 * @route   PUT /api/contracts/:id
 * @desc    Update contract
 * @access  Admin
 */
router.put("/:id", protect, authorize(ROLES.admin), updateContract);

/**
 * @route   PATCH /api/contracts/:id/status
 * @desc    Update contract status
 * @access  Admin
 */
router.patch("/:id/status", protect, authorize(ROLES.admin), updateContractStatus);

/**
 * @route   DELETE /api/contracts/:id
 * @desc    Delete contract
 * @access  Admin
 */
router.delete("/:id", protect, authorize(ROLES.admin), deleteContract);

export default router;
