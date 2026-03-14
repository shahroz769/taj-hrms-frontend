import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  deleteDepartment,
  updateDepartment,
  getAllDepartmentsList,
} from "../controllers/departmentController.js";
import { authorize } from "../middleware/rbacMiddleware.js";
import { ROLES } from "../utils/roles.js";

const router = express.Router();

// @route           GET /api/departments
// @description     Get all departments
// @access          Admin
router.get("/", protect, authorize(ROLES.admin), getAllDepartments);

// @description     Get all departments list for select options
// @route           GET /api/departments/list
// @access          Admin
router.get("/list", protect, authorize(ROLES.admin), getAllDepartmentsList);

// @route           GET /api/departments/:id
// @description     Get single department
// @access          Admin
router.get(
  "/:id",
  protect,
  authorize(ROLES.admin),
  getDepartmentById
);

// @route           POST /api/departments
// @description     Create new department
// @access          Admin only
router.post("/", protect, authorize(ROLES.admin), createDepartment);

// @route           PUT /api/departments/:id
// @description     Update department
// @access          Admin only
router.put("/:id", protect, authorize(ROLES.admin), updateDepartment);

// @route           DELETE /api/departments/:id
// @description     Delete department
// @access          Admin only
router.delete("/:id", protect, authorize(ROLES.admin), deleteDepartment);

export default router;
