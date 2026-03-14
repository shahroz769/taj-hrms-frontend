import AllowanceComponent from "../models/AllowanceComponent.js";
import AllowancePolicy from "../models/AllowancePolicy.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all allowance components
// @route           GET /api/allowance-components
// @access          Admin, Supervisor
export const getAllAllowanceComponents = async (req, res, next) => {
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
    const totalAllowanceComponents = await AllowanceComponent.countDocuments(query);

    // Get paginated allowance components
    const allowanceComponents = await AllowanceComponent.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      allowanceComponents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAllowanceComponents / limit),
        totalAllowanceComponents,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all allowance components list for select options
// @route           GET /api/allowance-components/list
// @access          Admin, Supervisor
export const getAllAllowanceComponentsList = async (req, res, next) => {
  try {
    const allowanceComponents = await AllowanceComponent.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(allowanceComponents);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single allowance component by ID
// @route           GET /api/allowance-components/:id
// @access          Admin
export const getAllowanceComponentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Component Not Found");
    }

    const allowanceComponent = await AllowanceComponent.findById(id);

    if (!allowanceComponent) {
      res.status(404);
      throw new Error("Allowance Component Not Found");
    }

    res.json(allowanceComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new allowance component
// @route           POST /api/allowance-components
// @access          Admin, Supervisor
export const createAllowanceComponent = async (req, res, next) => {
  try {
    const { name } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Allowance component name is required");
    }

    const existingAllowanceComponent = await AllowanceComponent.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingAllowanceComponent) {
      res.status(400);
      throw new Error("Allowance component with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newAllowanceComponent = new AllowanceComponent({
      name: name.trim(),
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedAllowanceComponent = await newAllowanceComponent.save();

    res.status(201).json(savedAllowanceComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update allowance component
// @route           PUT /api/allowance-components/:id
// @access          Admin
export const updateAllowanceComponent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Component Not Found");
    }

    const allowanceComponent = await AllowanceComponent.findById(id);

    if (!allowanceComponent) {
      res.status(404);
      throw new Error("Allowance component not found");
    }

    const { name } = req.body || {};

    // Validate required fields
    if (!name?.trim()) {
      res.status(400);
      throw new Error("Allowance component name is required");
    }

    // Check if new name conflicts with existing allowance component
    if (name.trim() !== allowanceComponent.name) {
      const existingAllowanceComponent = await AllowanceComponent.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingAllowanceComponent) {
        res.status(400);
        throw new Error("Allowance component with this name already exists");
      }
    }

    // Update allowance component fields
    allowanceComponent.name = name.trim();

    const updatedAllowanceComponent = await allowanceComponent.save();

    res.json(updatedAllowanceComponent);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update allowance component status (Approve/Reject)
// @route           PATCH /api/allowance-components/:id/status
// @access          Admin
export const updateAllowanceComponentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Component Not Found");
    }

    const allowanceComponent = await AllowanceComponent.findById(id);

    if (!allowanceComponent) {
      res.status(404);
      throw new Error("Allowance component not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`
      );
    }

    // Update allowance component status
    allowanceComponent.status = status;
    const updatedAllowanceComponent = await allowanceComponent.save();

    res.json({
      message: `Allowance component ${status.toLowerCase()} successfully`,
      allowanceComponent: updatedAllowanceComponent,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete allowance component
// @route           DELETE /api/allowance-components/:id
// @access          Admin
export const deleteAllowanceComponent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Component Not Found");
    }

    const allowanceComponent = await AllowanceComponent.findById(id);

    if (!allowanceComponent) {
      res.status(404);
      throw new Error("Allowance component not found");
    }

    // Check if allowance component is used in any allowance policies
    const allowancePolicyCount = await AllowancePolicy.countDocuments({
      "components.allowanceComponent": id,
    });

    if (allowancePolicyCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete allowance component. It is currently used in ${allowancePolicyCount} allowance ${
          allowancePolicyCount === 1 ? "policy" : "policies"
        }. Please remove it from all allowance policies first.`
      );
    }

    await allowanceComponent.deleteOne();

    res.json({
      message: "Allowance component deleted successfully",
      deletedAllowanceComponent: {
        id: allowanceComponent._id,
        name: allowanceComponent.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
