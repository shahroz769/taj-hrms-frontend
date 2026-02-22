import WarningType from "../models/WarningType.js";
import DisciplinaryAction from "../models/DisciplinaryAction.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all warning types (paginated)
// @route           GET /api/warning-types
// @access          Admin, Supervisor
export const getAllWarningTypes = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";

    const query = {};
    if (searchText.trim()) {
      query.name = { $regex: searchText.trim(), $options: "i" };
    }

    const skip = (page - 1) * limit;
    const totalWarningTypes = await WarningType.countDocuments(query);

    const warningTypes = await WarningType.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      warningTypes,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalWarningTypes / limit),
        totalWarningTypes,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all warning types list (for dropdowns)
// @route           GET /api/warning-types/list
// @access          Admin, Supervisor
export const getAllWarningTypesList = async (req, res, next) => {
  try {
    const warningTypes = await WarningType.find({ status: "Approved" })
      .sort({ name: 1 })
      .collation({ locale: "en", strength: 2 })
      .select("_id name severity");

    res.json(warningTypes);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new warning type
// @route           POST /api/warning-types
// @access          Admin
export const createWarningType = async (req, res, next) => {
  try {
    const { name, severity } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Warning type name is required");
    }

    const existingWarningType = await WarningType.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingWarningType) {
      res.status(400);
      throw new Error("Warning type with this name already exists");
    }

    const validSeverities = ["Low", "Medium", "High"];
    if (severity && !validSeverities.includes(severity)) {
      res.status(400);
      throw new Error(
        `Invalid severity. Valid values are: ${validSeverities.join(", ")}`,
      );
    }

    const isAdmin = req.user.role === ROLES.admin;

    const newWarningType = new WarningType({
      name: name.trim(),
      severity: severity || "Low",
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedWarningType = await newWarningType.save();
    res.status(201).json(savedWarningType);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update warning type
// @route           PUT /api/warning-types/:id
// @access          Admin
export const updateWarningType = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Warning Type Not Found");
    }

    const warningType = await WarningType.findById(id);
    if (!warningType) {
      res.status(404);
      throw new Error("Warning type not found");
    }

    const { name, severity } = req.body || {};

    if (!name?.trim()) {
      res.status(400);
      throw new Error("Warning type name is required");
    }

    // Check duplicate name
    if (name.trim() !== warningType.name) {
      const existing = await WarningType.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });
      if (existing) {
        res.status(400);
        throw new Error("Warning type with this name already exists");
      }
    }

    const validSeverities = ["Low", "Medium", "High"];
    if (severity && !validSeverities.includes(severity)) {
      res.status(400);
      throw new Error(
        `Invalid severity. Valid values are: ${validSeverities.join(", ")}`,
      );
    }

    warningType.name = name.trim();
    if (severity) warningType.severity = severity;

    const updatedWarningType = await warningType.save();
    res.json(updatedWarningType);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update warning type status (Approve/Reject)
// @route           PATCH /api/warning-types/:id/status
// @access          Admin
export const updateWarningTypeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Warning Type Not Found");
    }

    const warningType = await WarningType.findById(id);
    if (!warningType) {
      res.status(404);
      throw new Error("Warning type not found");
    }

    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
      );
    }

    warningType.status = status;
    const updatedWarningType = await warningType.save();

    res.json({
      message: `Warning type ${status.toLowerCase()} successfully`,
      warningType: updatedWarningType,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete warning type
// @route           DELETE /api/warning-types/:id
// @access          Admin
export const deleteWarningType = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Warning Type Not Found");
    }

    const warningType = await WarningType.findById(id);
    if (!warningType) {
      res.status(404);
      throw new Error("Warning type not found");
    }

    // Check if warning type is used in any disciplinary actions
    const actionCount = await DisciplinaryAction.countDocuments({
      warningType: id,
    });

    if (actionCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete warning type. It is currently used in ${actionCount} disciplinary ${
          actionCount === 1 ? "action" : "actions"
        }. Please remove it from all disciplinary actions first.`,
      );
    }

    await warningType.deleteOne();

    res.json({
      message: "Warning type deleted successfully",
      deletedWarningType: {
        id: warningType._id,
        name: warningType.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
