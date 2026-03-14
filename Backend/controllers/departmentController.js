import Department from "../models/Department.js";
import Position from "../models/Position.js";
import mongoose from "mongoose";

// @description     Get all departments
// @route           GET /api/departments
// @access          Admin
export const getAllDepartments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";

    // Build search query
    const query = {};
    if (searchText.trim()) {
      query.name = { $regex: searchText.trim(), $options: "i" };
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalDepartments = await Department.countDocuments(query);

    // Get paginated departments
    const departments = await Department.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      departments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDepartments / limit),
        totalDepartments,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all departments list for select options
// @route           GET /api/departments/list
// @access          Admin
export const getAllDepartmentsList = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(departments);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single department by ID
// @route           GET /api/departments/:id
// @access          Admin
export const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Department Not Found");
    }

    const department = await Department.findById(id);

    if (!department) {
      res.status(404);
      throw new Error("Department Not Found");
    }

    res.json(department);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new department
// @route           POST /api/departments
// @access          Admin
export const createDepartment = async (req, res, next) => {
  try {
    const { name, positionCount } = req.body || {};

    if (!name?.trim() || !positionCount?.toString().trim()) {
      res.status(400);
      throw new Error("Department name and position count are required");
    }

    // Check if department already exists
    const existingDepartment = await Department.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingDepartment) {
      res.status(400);
      throw new Error("Department with this name already exists");
    }

    const newDepartment = new Department({
      name: name.trim(),
      positionCount: positionCount,
      createdBy: req.user._id,
    });

    const savedDepartment = await newDepartment.save();

    res.status(201).json(savedDepartment);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update department
// @route           PUT /api/departments/:id
// @access          Admin
export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(id, req.body);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Department Not Found");
    }

    const department = await Department.findById(id);

    if (!department) {
      res.status(404);
      throw new Error("Department not found");
    }

    const { name, positionCount } = req.body || {};

    // if (!name?.trim() || !positionCount?.toString().trim()) {
    //   res.status(400);
    //   throw new Error("Department name and position count are required");
    // }

    // Check if new name conflicts with existing department
    if (name && name.trim() !== department.name) {
      const existingDepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingDepartment) {
        res.status(400);
        throw new Error("Department with this name already exists");
      }
      department.name = name.trim();
    }

    if (positionCount !== undefined) {
      const newLimit = positionCount?.toString().trim().toLowerCase();

      // If the new limit is not "unlimited", validate against current position count
      if (newLimit && newLimit !== "unlimited") {
        const parsedLimit = parseInt(newLimit, 10);

        if (isNaN(parsedLimit)) {
          res.status(400);
          throw new Error(
            "Position count must be a valid number or 'unlimited'"
          );
        }

        // Count current positions in this department
        const currentPositionCount = await Position.countDocuments({
          department: id,
        });

        if (parsedLimit < currentPositionCount) {
          res.status(400);
          throw new Error(
            `Cannot set position limit to ${parsedLimit}. Department currently has ${currentPositionCount} position(s). Please remove positions first or set a higher limit.`
          );
        }
      }

      department.positionCount = positionCount;
    }

    // if (isActive !== undefined) {
    //   department.isActive = isActive;
    // }

    const updatedDepartment = await department.save();

    res.json(updatedDepartment);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete department
// @route           DELETE /api/departments/:id
// @access          Admin
export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Department Not Found");
    }

    const department = await Department.findById(id);

    if (!department) {
      res.status(404);
      throw new Error("Department not found");
    }

    // Check if department has positions
    const positionCount = await Position.countDocuments({ department: id });
    if (positionCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete department with ${positionCount} active position(s). Please delete or reassign positions first.`
      );
    }

    // Check if department has employees
    if (department.employeeCount > 0) {
      res.status(400);
      throw new Error(
        "Cannot delete department with active employees. Please reassign employees first."
      );
    }

    await department.deleteOne();

    res.json({
      message: "Department deleted successfully",
      deletedDepartment: {
        id: department._id,
        name: department.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
