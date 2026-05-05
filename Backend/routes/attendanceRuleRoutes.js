import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";
import {
  getAttendanceRulesHandler,
  updateAttendanceRulesHandler,
} from "../controllers/attendanceRuleController.js";

const router = express.Router();

// @route           GET /api/attendance-rules
// @description     Get the org-wide attendance rules
// @access          Admin
router.get("/", protect, authorize(ROLES.admin), getAttendanceRulesHandler);

// @route           PUT /api/attendance-rules
// @description     Update the org-wide attendance rules
// @access          Admin
router.put("/", protect, authorize(ROLES.admin), updateAttendanceRulesHandler);

export default router;
