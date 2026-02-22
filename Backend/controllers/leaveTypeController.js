import LeaveType from "../models/LeaveType.js";
import LeavePolicy from "../models/LeavePolicy.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all leave types
// @route           GET /api/leave-types
// @access          Admin, Supervisor
export const getAllLeaveTypes = async (req, res, next) => {
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
    const totalLeaveTypes = await LeaveType.countDocuments(query);

    // Get paginated positions
    const leaveTypes = await LeaveType.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      leaveTypes,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLeaveTypes / limit),
        totalLeaveTypes,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all leave types list for select options
// @route           GET /api/leave-types/list
// @access          Admin, Supervisor
export const getAllLeaveTypesList = async (req, res, next) => {
  try {
    const leaveTypes = await LeaveType.find()
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name");

    res.json(leaveTypes);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all positions, reportsTo, departments for filter
// @route           GET /api/positions/filters
// @access          Admin
// export const getAllPositionsFiltersList = async (req, res, next) => {
//   try {
//     const positionsFiltersList = await Position.find()
//       .populate("department", "name")
//       .select("name reportsTo department");
//     res.json({
//       positionsFiltersList,
//     });
//   } catch (err) {
//     console.log(err);
//     next(err);
//   }
// };

// @description     Get single position by ID
// @route           GET /api/positions/:id
// @access          Admin
// export const getPositionById = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       res.status(404);
//       throw new Error("Position Not Found");
//     }

//     const position = await Position.findById(id);

//     if (!position) {
//       res.status(404);
//       throw new Error("Position Not Found");
//     }

//     res.json(position);
//   } catch (err) {
//     console.log(err);
//     next(err);
//   }
// };

// @description     Create new leave type
// @route           POST /api/leave-types
// @access          Admin
export const createLeaveType = async (req, res, next) => {
  try {
    const { name, isPaid } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Leave type name is required");
    }

    const existingLeaveType = await LeaveType.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingLeaveType) {
      res.status(400);
      throw new Error("Leave type with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newLeaveType = new LeaveType({
      name: name.trim(),
      isPaid: isPaid !== undefined ? Boolean(isPaid) : false,
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedLeaveType = await newLeaveType.save();

    res.status(201).json(savedLeaveType);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update leave type
// @route           PUT /api/leave-types/:id
// @access          Admin
export const updateLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Type Not Found");
    }

    const leaveType = await LeaveType.findById(id);

    if (!leaveType) {
      res.status(404);
      throw new Error("Leave type not found");
    }

    const { name, isPaid } = req.body || {};

    // Validate required fields
    if (!name?.trim()) {
      res.status(400);
      throw new Error("Leave type name is required");
    }

    // Check if new name conflicts with existing leave type
    if (name.trim() !== leaveType.name) {
      const existingLeaveType = await LeaveType.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingLeaveType) {
        res.status(400);
        throw new Error("Leave type with this name already exists");
      }
    }

    // Update leave type fields
    leaveType.name = name.trim();
    leaveType.isPaid =
      isPaid !== undefined ? Boolean(isPaid) : leaveType.isPaid;

    const updatedLeaveType = await leaveType.save();

    res.json(updatedLeaveType);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update leave type status (Approve/Reject)
// @route           PATCH /api/leave-types/:id/status
// @access          Admin
export const updateLeaveTypeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Type Not Found");
    }

    const leaveType = await LeaveType.findById(id);

    if (!leaveType) {
      res.status(404);
      throw new Error("Leave type not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`
      );
    }

    // Update leave type status
    leaveType.status = status;
    const updatedLeaveType = await leaveType.save();

    res.json({
      message: `Leave type ${status.toLowerCase()} successfully`,
      leaveType: updatedLeaveType,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete leave type
// @route           DELETE /api/leave-types/:id
// @access          Admin
export const deleteLeaveType = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Leave Type Not Found");
    }

    const leaveType = await LeaveType.findById(id);

    if (!leaveType) {
      res.status(404);
      throw new Error("Leave type not found");
    }

    // Check if leave type is used in any leave policies
    const leavePolicyCount = await LeavePolicy.countDocuments({
      "entitlements.leaveType": id,
    });

    if (leavePolicyCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete leave type. It is currently used in ${leavePolicyCount} leave ${
          leavePolicyCount === 1 ? "policy" : "policies"
        }. Please remove it from all leave policies first.`
      );
    }

    await leaveType.deleteOne();

    res.json({
      message: "Leave type deleted successfully",
      deletedLeaveType: {
        id: leaveType._id,
        name: leaveType.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
