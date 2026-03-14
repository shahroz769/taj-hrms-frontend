import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createDeduction,
  deleteDeduction,
  getDeductions,
  searchEmployeesForDeduction,
  updateDeduction,
} from "../controllers/deductionController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/deductions
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getDeductions,
);

// @route           GET /api/deductions/search-employees?q=
router.get(
  "/search-employees",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  searchEmployeesForDeduction,
);

// @route           POST /api/deductions
router.post("/", protect, authorize(ROLES.admin), createDeduction);

// @route           PUT /api/deductions/:id
router.put("/:id", protect, authorize(ROLES.admin), updateDeduction);

// @route           DELETE /api/deductions/:id
router.delete("/:id", protect, authorize(ROLES.admin), deleteDeduction);

export default router;
