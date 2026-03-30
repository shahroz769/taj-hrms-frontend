import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  getLoans,
  searchEmployeesForLoan,
  getLoanDetails,
  createLoan,
  approveLoan,
  rejectLoan,
  settleLoan,
  deleteLoan,
} from "../controllers/loanController.js";

const router = express.Router();

// @route   GET /api/loans
router.get("/", protect, authorize(ROLES.admin, ROLES.supervisor), getLoans);

// @route   GET /api/loans/search-employees?q=
router.get(
  "/search-employees",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  searchEmployeesForLoan,
);

// @route   GET /api/loans/:id
router.get("/:id", protect, authorize(ROLES.admin, ROLES.supervisor), getLoanDetails);

// @route   POST /api/loans
router.post("/", protect, authorize(ROLES.admin, ROLES.supervisor), createLoan);

// @route   PATCH /api/loans/:id/approve
router.patch("/:id/approve", protect, authorize(ROLES.admin), approveLoan);

// @route   PATCH /api/loans/:id/reject
router.patch("/:id/reject", protect, authorize(ROLES.admin), rejectLoan);

// @route   PATCH /api/loans/:id/settle
router.patch("/:id/settle", protect, authorize(ROLES.admin), settleLoan);

// @route   DELETE /api/loans/:id
router.delete("/:id", protect, authorize(ROLES.admin), deleteLoan);

export default router;
