import Position from "../models/Position.js";
import Department from "../models/Department.js";
import mongoose from "mongoose";

// @description     Get all positions
// @route           GET /api/positions
// @access          Admin
export const getAllPositions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";
    const departmentFilter = req.query.department || "";
    const reportsToFilter = req.query.reportsTo || "";

    // Build search and filter query
    const query = {};

    // Search by position name
    if (searchText.trim()) {
      query.name = { $regex: searchText.trim(), $options: "i" };
    }

    // Filter by department
    if (departmentFilter.trim()) {
      query.department = departmentFilter.trim();
    }

    // Filter by reportsTo
    if (reportsToFilter.trim()) {
      query.reportsTo = reportsToFilter.trim();
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalPositions = await Position.countDocuments(query);

    // Get paginated positions
    const positions = await Position.find(query)
      .populate("department", "name")
      .populate("reportsTo", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      positions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPositions / limit),
        totalPositions,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all positions, reportsTo, departments for filter
// @route           GET /api/positions/filters
// @access          Admin
export const getAllPositionsFiltersList = async (req, res, next) => {
  try {
    const positionsFiltersList = await Position.find()
      .populate("department", "name")
      .select("name reportsTo department");
    res.json({
      positionsFiltersList,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get positions by department ID
// @route           GET /api/positions/by-department/:departmentId
// @access          Admin
export const getPositionsByDepartment = async (req, res, next) => {
  try {
    const { departmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      res.status(400);
      throw new Error("Invalid department ID");
    }

    const positions = await Position.find({ department: departmentId })
      .select("name employeeLimit hiredEmployees");

    res.json({ positions });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single position by ID
// @route           GET /api/positions/:id
// @access          Admin
export const getPositionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id)
      .populate("department", "name");
    if (!position) {
      res.status(404);
      throw new Error("Position not found");
    }
    res.json(position);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new position
// @route           POST /api/positions
// @access          Admin
export const createPosition = async (req, res, next) => {
  try {
    const { name, reportsTo, employeeLimit, department } = req.body || {};

    if (
      !name?.trim() ||
      !employeeLimit?.toString().trim() ||
      !reportsTo?.trim() ||
      !department?.trim()
    ) {
      res.status(400);
      throw new Error(
        "Position name, position limit, reports to and department are required",
      );
    }

    // Validate department ID
    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400);
      throw new Error("Invalid department ID");
    }

    // Check if department exists
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404);
      throw new Error("Department not found");
    }

    // Check if position already exists in this department
    const existingPosition = await Position.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      department: department,
    });

    if (existingPosition) {
      res.status(400);
      throw new Error(
        "Position with this name already exists in this department",
      );
    }

    const newPosition = new Position({
      name: name.trim(),
      department: department,
      reportsTo: reportsTo,
      employeeLimit: employeeLimit,
      createdBy: req.user._id,
    });

    const savedPosition = await newPosition.save();

    const populatedPosition = await Position.findById(savedPosition._id)
      .populate("department", "name");

    res.status(201).json(populatedPosition);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update position
// @route           PUT /api/positions/:id
// @access          Admin
export const updatePosition = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id);

    if (!position) {
      res.status(404);
      throw new Error("Position not found");
    }

    const { name, reportsTo, employeeLimit, department } = req.body || {};

    if (
      !name?.trim() ||
      !employeeLimit?.toString().trim() ||
      !reportsTo?.trim() ||
      !department?.trim()
    ) {
      res.status(400);
      throw new Error(
        "Position name, position limit, reports to and department are required",
      );
    }

    // Validate department ID
    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400);
      throw new Error("Invalid department ID");
    }

    // Check if department exists
    const departmentDoc = await Department.findById(department);
    if (!departmentDoc) {
      res.status(404);
      throw new Error("Department not found");
    }

    // Check if new name conflicts with existing position in the target department
    if (
      name.trim() !== position.name ||
      department !== position.department.toString()
    ) {
      const existingPosition = await Position.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        department: department,
        _id: { $ne: id },
      });

      if (existingPosition) {
        res.status(400);
        throw new Error(
          "Position with this name already exists in this department",
        );
      }
    }

    // Update position fields
    position.name = name.trim();
    position.department = department;
    position.reportsTo = reportsTo;
    position.employeeLimit = employeeLimit;

    const updatedPosition = await position.save();

    const populatedPosition = await Position.findById(updatedPosition._id)
      .populate("department", "name");

    res.json(populatedPosition);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete position
// @route           DELETE /api/positions/:id
// @access          Admin
export const deletePosition = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Position Not Found");
    }

    const position = await Position.findById(id);

    if (!position) {
      res.status(404);
      throw new Error("Position not found");
    }

    // Check if position has employees
    if (position.hiredEmployees > 0) {
      res.status(400);
      throw new Error(
        "Cannot delete position with active employees. Please reassign employees first.",
      );
    }

    await position.deleteOne();

    res.json({
      message: "Position deleted successfully",
      deletedPosition: {
        id: position._id,
        name: position.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
