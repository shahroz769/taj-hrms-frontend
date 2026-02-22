import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createWorkProgressReport,
  deleteWorkProgressReport,
  getAllWorkProgressReports,
  getWorkProgressReportById,
  updateWorkProgressReport,
  searchEmployees,
  startTask,
  completeTask,
  addRemarks,
  closeTask,
  getEmployeeProgressReports,
} from "../controllers/workProgressReportController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/work-progress-reports/search-employees?q=
// Employee search for task assignment (debounce on frontend)
router.get(
  "/search-employees",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  searchEmployees,
);

// @route           GET /api/work-progress-reports/employee-progress
// Aggregated employee progress (tasks completed & avg rating)
router.get(
  "/employee-progress",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getEmployeeProgressReports,
);

// @route           GET /api/work-progress-reports
router.get(
  "/",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getAllWorkProgressReports,
);

// @route           GET /api/work-progress-reports/:id
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getWorkProgressReportById,
);

// @route           POST /api/work-progress-reports
// Admin assigns task
router.post("/", protect, authorize(ROLES.admin), createWorkProgressReport);

// @route           PUT /api/work-progress-reports/:id
// Edit task (only Pending tasks, Admin only)
router.put("/:id", protect, authorize(ROLES.admin), updateWorkProgressReport);

// @route           PUT /api/work-progress-reports/:id/start
// Start task (Pending → In Progress)
router.put(
  "/:id/start",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  startTask,
);

// @route           PUT /api/work-progress-reports/:id/complete
// Complete task (In Progress → Completed)
router.put(
  "/:id/complete",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  completeTask,
);

// @route           POST /api/work-progress-reports/:id/remarks
// Add remarks to a task
router.post(
  "/:id/remarks",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  addRemarks,
);

// @route           PUT /api/work-progress-reports/:id/close
// Close task (Completed → Closed, Admin only)
router.put("/:id/close", protect, authorize(ROLES.admin), closeTask);

// @route           DELETE /api/work-progress-reports/:id
router.delete(
  "/:id",
  protect,
  authorize(ROLES.admin),
  deleteWorkProgressReport,
);

export default router;
