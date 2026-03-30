import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { getDashboardOverview } from "../controllers/dashboardController.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

router.get(
  "/overview",
  protect,
  authorize(ROLES.admin, ROLES.supervisor),
  getDashboardOverview,
);

export default router;
