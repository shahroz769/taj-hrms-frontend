import AllowancePolicy from "../models/AllowancePolicy.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all allowance policies
// @route           GET /api/allowance-policies
// @access          Admin, Supervisor
export const getAllAllowancePolicies = async (req, res, next) => {
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
    const totalAllowancePolicies = await AllowancePolicy.countDocuments(query);

    // Get paginated allowance policies
    const allowancePolicies = await AllowancePolicy.find(query)
      .populate("components.allowanceComponent", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      allowancePolicies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalAllowancePolicies / limit),
        totalAllowancePolicies,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all allowance policies list for select options
// @route           GET /api/allowance-policies/list
// @access          Admin, Supervisor
export const getAllAllowancePoliciesList = async (req, res, next) => {
  try {
    const allowancePolicies = await AllowancePolicy.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(allowancePolicies);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single allowance policy by ID
// @route           GET /api/allowance-policies/:id
// @access          Admin, Supervisor
export const getAllowancePolicyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Policy Not Found");
    }

    const allowancePolicy = await AllowancePolicy.findById(id).populate(
      "components.allowanceComponent",
      "name"
    );

    if (!allowancePolicy) {
      res.status(404);
      throw new Error("Allowance Policy Not Found");
    }

    res.json(allowancePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new allowance policy
// @route           POST /api/allowance-policies
// @access          Admin
export const createAllowancePolicy = async (req, res, next) => {
  try {
    const { name, components } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Allowance policy name is required");
    }

    if (!components || !Array.isArray(components) || components.length === 0) {
      res.status(400);
      throw new Error("At least one allowance component is required");
    }

    // Validate components
    for (const component of components) {
      if (
        !component.allowanceComponent ||
        !mongoose.Types.ObjectId.isValid(component.allowanceComponent)
      ) {
        res.status(400);
        throw new Error("Invalid allowance component ID in components");
      }
      if (component.amount === undefined || component.amount < 0) {
        res.status(400);
        throw new Error("Amount must be a non-negative number");
      }
    }

    // Check if allowance policy already exists
    const existingAllowancePolicy = await AllowancePolicy.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingAllowancePolicy) {
      res.status(400);
      throw new Error("Allowance policy with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newAllowancePolicy = new AllowancePolicy({
      name: name.trim(),
      components,
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedAllowancePolicy = await newAllowancePolicy.save();

    // Populate the allowance components in the response
    await savedAllowancePolicy.populate("components.allowanceComponent", "name");

    res.status(201).json(savedAllowancePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update allowance policy
// @route           PUT /api/allowance-policies/:id
// @access          Admin
export const updateAllowancePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Policy Not Found");
    }

    const allowancePolicy = await AllowancePolicy.findById(id);

    if (!allowancePolicy) {
      res.status(404);
      throw new Error("Allowance policy not found");
    }

    const { name, components } = req.body || {};

    // Validate name if provided
    if (name && name.trim()) {
      // Check if new name conflicts with existing allowance policy
      if (name.trim() !== allowancePolicy.name) {
        const existingAllowancePolicy = await AllowancePolicy.findOne({
          name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
          _id: { $ne: id },
        });

        if (existingAllowancePolicy) {
          res.status(400);
          throw new Error("Allowance policy with this name already exists");
        }
      }
      allowancePolicy.name = name.trim();
    }

    // Validate and update components if provided
    if (components) {
      if (!Array.isArray(components) || components.length === 0) {
        res.status(400);
        throw new Error("At least one allowance component is required");
      }

      // Validate each component
      for (const component of components) {
        if (
          !component.allowanceComponent ||
          !mongoose.Types.ObjectId.isValid(component.allowanceComponent)
        ) {
          res.status(400);
          throw new Error("Invalid allowance component ID in components");
        }
        if (component.amount === undefined || component.amount < 0) {
          res.status(400);
          throw new Error("Amount must be a non-negative number");
        }
      }

      allowancePolicy.components = components;
    }

    const updatedAllowancePolicy = await allowancePolicy.save();

    // Populate the allowance components in the response
    await updatedAllowancePolicy.populate("components.allowanceComponent", "name");

    res.json(updatedAllowancePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update allowance policy status (Approve/Reject)
// @route           PATCH /api/allowance-policies/:id/status
// @access          Admin
export const updateAllowancePolicyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Policy Not Found");
    }

    const allowancePolicy = await AllowancePolicy.findById(id).populate(
      "components.allowanceComponent",
      "name"
    );

    if (!allowancePolicy) {
      res.status(404);
      throw new Error("Allowance policy not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`
      );
    }

    // Update allowance policy status
    allowancePolicy.status = status;
    const updatedAllowancePolicy = await allowancePolicy.save();

    res.json({
      message: `Allowance policy ${status.toLowerCase()} successfully`,
      allowancePolicy: updatedAllowancePolicy,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete allowance policy
// @route           DELETE /api/allowance-policies/:id
// @access          Admin
export const deleteAllowancePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Allowance Policy Not Found");
    }

    const allowancePolicy = await AllowancePolicy.findById(id);

    if (!allowancePolicy) {
      res.status(404);
      throw new Error("Allowance policy not found");
    }

    await allowancePolicy.deleteOne();

    res.json({
      message: "Allowance policy deleted successfully",
      deletedAllowancePolicy: {
        id: allowancePolicy._id,
        name: allowancePolicy.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
