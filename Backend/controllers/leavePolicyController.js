import LeavePolicy from "../models/LeavePolicy.js";
import Position from "../models/Position.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";
import Employee from "../models/Employee.js";
import LeaveBalance from "../models/LeaveBalance.js";

// @description     Get all leave policies
// @route           GET /api/leave-policies
// @access          Admin, Supervisor
export const getAllLeavePolicies = async (req, res, next) => {
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
    const totalLeavePolicies = await LeavePolicy.countDocuments(query);

    // Get paginated leave policies
    const leavePolicies = await LeavePolicy.find(query)
      .populate("entitlements.leaveType", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      leavePolicies,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeavePolicies / limit),
        totalLeavePolicies,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all leave policies list for select options
// @route           GET /api/leave-policies/list
// @access          Admin, Supervisor
export const getAllLeavePoliciesList = async (req, res, next) => {
  try {
    const leavePolicies = await LeavePolicy.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(leavePolicies);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single leave policy by ID
// @route           GET /api/leave-policies/:id
// @access          Admin, Supervisor
export const getLeavePolicyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Policy Not Found");
    }

    const leavePolicy = await LeavePolicy.findById(id).populate(
      "entitlements.leaveType",
      "name",
    );

    if (!leavePolicy) {
      res.status(404);
      throw new Error("Leave Policy Not Found");
    }

    res.json(leavePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new leave policy
// @route           POST /api/leave-policies
// @access          Admin
export const createLeavePolicy = async (req, res, next) => {
  try {
    const { name, entitlements } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Leave policy name is required");
    }

    if (
      !entitlements ||
      !Array.isArray(entitlements) ||
      entitlements.length === 0
    ) {
      res.status(400);
      throw new Error("At least one leave type entitlement is required");
    }

    // Validate entitlements
    for (const entitlement of entitlements) {
      if (
        !entitlement.leaveType ||
        !mongoose.Types.ObjectId.isValid(entitlement.leaveType)
      ) {
        res.status(400);
        throw new Error("Invalid leave type ID in entitlements");
      }
      if (entitlement.days === undefined || entitlement.days < 0) {
        res.status(400);
        throw new Error("Days must be a non-negative number");
      }
    }

    // Check if leave policy already exists
    const existingLeavePolicy = await LeavePolicy.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingLeavePolicy) {
      res.status(400);
      throw new Error("Leave policy with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newLeavePolicy = new LeavePolicy({
      name: name.trim(),
      entitlements,
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedLeavePolicy = await newLeavePolicy.save();

    // Populate the leave types in the response
    await savedLeavePolicy.populate("entitlements.leaveType", "name");

    res.status(201).json(savedLeavePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update leave policy
// @route           PUT /api/leave-policies/:id
// @access          Admin
export const updateLeavePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Policy Not Found");
    }

    const leavePolicy = await LeavePolicy.findById(id);

    if (!leavePolicy) {
      res.status(404);
      throw new Error("Leave policy not found");
    }

    const { name, entitlements } = req.body || {};

    // Validate name if provided
    if (name && name.trim()) {
      // Check if new name conflicts with existing leave policy
      if (name.trim() !== leavePolicy.name) {
        const existingLeavePolicy = await LeavePolicy.findOne({
          name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
          _id: { $ne: id },
        });

        if (existingLeavePolicy) {
          res.status(400);
          throw new Error("Leave policy with this name already exists");
        }
      }
      leavePolicy.name = name.trim();
    }

    // Validate and update entitlements if provided
    if (entitlements) {
      if (!Array.isArray(entitlements) || entitlements.length === 0) {
        res.status(400);
        throw new Error("At least one leave type entitlement is required");
      }

      // Validate each entitlement
      for (const entitlement of entitlements) {
        if (
          !entitlement.leaveType ||
          !mongoose.Types.ObjectId.isValid(entitlement.leaveType)
        ) {
          res.status(400);
          throw new Error("Invalid leave type ID in entitlements");
        }
        if (entitlement.days === undefined || entitlement.days < 0) {
          res.status(400);
          throw new Error("Days must be a non-negative number");
        }
      }

      leavePolicy.entitlements = entitlements;
    }

    const updatedLeavePolicy = await leavePolicy.save();

    // --- Propagate changes to Leave Balances ---
    const currentYear = new Date().getFullYear();

    // Find all positions using this policy
    const positions = await Position.find({ leavePolicy: id }).select("_id");
    const positionIds = positions.map((p) => p._id);

    // Find all active employees in these positions
    const employees = await Employee.find({
      position: { $in: positionIds },
      status: "Active",
    }).select("_id");

    // Update or create leave balances for each employee
    for (const employee of employees) {
      for (const entitlement of updatedLeavePolicy.entitlements) {
        // use findOneAndUpdate with upsert to handle both cases efficiently
        // We need to calculate remainingDays based on existing usedDays if record exists

        const existingBalance = await LeaveBalance.findOne({
          employee: employee._id,
          leaveType: entitlement.leaveType,
          year: currentYear,
        });

        if (existingBalance) {
          existingBalance.totalDays = entitlement.days;
          existingBalance.remainingDays = Math.max(
            0,
            existingBalance.totalDays - existingBalance.usedDays,
          );
          await existingBalance.save();
        } else {
          await LeaveBalance.create({
            employee: employee._id,
            leaveType: entitlement.leaveType,
            totalDays: entitlement.days,
            usedDays: 0,
            remainingDays: entitlement.days,
            year: currentYear,
          });
        }
      }
    }

    // Populate the leave types in the response
    await updatedLeavePolicy.populate("entitlements.leaveType", "name");

    res.json(updatedLeavePolicy);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update leave policy status (Approve/Reject)
// @route           PATCH /api/leave-policies/:id/status
// @access          Admin
export const updateLeavePolicyStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Policy Not Found");
    }

    const leavePolicy = await LeavePolicy.findById(id).populate(
      "entitlements.leaveType",
      "name",
    );

    if (!leavePolicy) {
      res.status(404);
      throw new Error("Leave policy not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
      );
    }

    // Update leave policy status
    leavePolicy.status = status;
    const updatedLeavePolicy = await leavePolicy.save();

    res.json({
      message: `Leave policy ${status.toLowerCase()} successfully`,
      leavePolicy: updatedLeavePolicy,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete leave policy
// @route           DELETE /api/leave-policies/:id
// @access          Admin
export const deleteLeavePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Policy Not Found");
    }

    const leavePolicy = await LeavePolicy.findById(id);

    if (!leavePolicy) {
      res.status(404);
      throw new Error("Leave policy not found");
    }

    // Check if leave policy is assigned to any positions
    const positionCount = await Position.countDocuments({ leavePolicy: id });
    if (positionCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete leave policy assigned to ${positionCount} position(s). Please reassign positions first.`,
      );
    }

    await leavePolicy.deleteOne();

    res.json({
      message: "Leave policy deleted successfully",
      deletedLeavePolicy: {
        id: leavePolicy._id,
        name: leavePolicy.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
