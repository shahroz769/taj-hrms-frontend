import express from "express";
import {
  downloadPayslipPdf,
  generatePayrolls,
  getPayrollById,
  getPayrollMonthlySummary,
  getPayrolls,
  getPayslipPayload,
  markPayrollAsPaid,
  previewPayrollGeneration,
  regenerateEmployeePayroll,
} from "../controllers/payrollController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

router.get("/", protect, authorize(ROLES.admin, ROLES.supervisor), getPayrolls);
router.get("/monthly-summary", protect, authorize(ROLES.admin, ROLES.supervisor), getPayrollMonthlySummary);
router.get("/preview", protect, authorize(ROLES.admin), previewPayrollGeneration);
router.post("/generate", protect, authorize(ROLES.admin), generatePayrolls);
router.post("/:employeeId/regenerate", protect, authorize(ROLES.admin), regenerateEmployeePayroll);
router.get("/:id/payslip", protect, authorize(ROLES.admin, ROLES.supervisor), getPayslipPayload);
router.get("/:id/payslip/pdf", protect, authorize(ROLES.admin, ROLES.supervisor), downloadPayslipPdf);
router.patch("/:id/mark-paid", protect, authorize(ROLES.admin), markPayrollAsPaid);
router.get("/:id", protect, authorize(ROLES.admin, ROLES.supervisor), getPayrollById);

export default router;
