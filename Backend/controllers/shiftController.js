import Shift from "../models/Shift.js";
import EmployeeShift from "../models/EmployeeShift.js";
import mongoose from "mongoose";
import { ROLES } from "../utils/roles.js";

// @description     Get all shifts
// @route           GET /api/shifts
// @access          Admin
export const getAllShifts = async (req, res, next) => {
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
    const totalShifts = await Shift.countDocuments(query);

    // Get paginated positions
    const shifts = await Shift.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      shifts,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalShifts / limit),
        totalShifts,
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

// @description     Create new shift
// @route           POST /api/shifts
// @access          Admin
export const createShift = async (req, res, next) => {
  try {
    const { name, startTime, endTime, workingDays, notes } = req.body || {};

    // Validate required fields
    if (!name?.trim()) {
      res.status(400);
      throw new Error("Shift name is required");
    }

    if (!startTime?.trim()) {
      res.status(400);
      throw new Error("Start time is required");
    }

    if (!endTime?.trim()) {
      res.status(400);
      throw new Error("End time is required");
    }

    if (
      !workingDays ||
      !Array.isArray(workingDays) ||
      workingDays.length === 0
    ) {
      res.status(400);
      throw new Error("At least one working day is required");
    }

    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    const invalidDays = workingDays.filter((day) => !validDays.includes(day));
    if (invalidDays.length > 0) {
      res.status(400);
      throw new Error(
        `Invalid working day(s): ${invalidDays.join(", ")}. Valid days are: ${validDays.join(", ")}`,
      );
    }

    // Check if shift with same name already exists
    const existingShift = await Shift.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (existingShift) {
      res.status(400);
      throw new Error("Shift with this name already exists");
    }

    // Check if user is admin
    const isAdmin = req.user.role === ROLES.admin;

    const newShift = new Shift({
      name: name.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      workingDays: workingDays,
      notes: notes?.trim() || "",
      status: isAdmin ? "Approved" : "Pending",
      createdBy: isAdmin ? req.user.name : req.user._id,
    });

    const savedShift = await newShift.save();

    res.status(201).json(savedShift);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update shift
// @route           PUT /api/shifts/:id
// @access          Admin
export const updateShift = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Shift Not Found");
    }

    const shift = await Shift.findById(id);

    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    const { name, startTime, endTime, workingDays, notes } = req.body || {};

    // Validate required fields
    if (!name?.trim()) {
      res.status(400);
      throw new Error("Shift name is required");
    }

    if (!startTime?.trim()) {
      res.status(400);
      throw new Error("Start time is required");
    }

    if (!endTime?.trim()) {
      res.status(400);
      throw new Error("End time is required");
    }

    if (
      !workingDays ||
      !Array.isArray(workingDays) ||
      workingDays.length === 0
    ) {
      res.status(400);
      throw new Error("At least one working day is required");
    }

    const validDays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    const invalidDays = workingDays.filter((day) => !validDays.includes(day));
    if (invalidDays.length > 0) {
      res.status(400);
      throw new Error(
        `Invalid working day(s): ${invalidDays.join(", ")}. Valid days are: ${validDays.join(", ")}`,
      );
    }

    // Check if new name conflicts with existing shift
    if (name.trim() !== shift.name) {
      const existingShift = await Shift.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingShift) {
        res.status(400);
        throw new Error("Shift with this name already exists");
      }
    }

    // Update shift fields
    shift.name = name.trim();
    shift.startTime = startTime.trim();
    shift.endTime = endTime.trim();
    shift.workingDays = workingDays;
    shift.notes = notes?.trim() || "";

    const updatedShift = await shift.save();

    res.json(updatedShift);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update shift status (Approve/Reject)
// @route           PATCH /api/shifts/:id/status
// @access          Admin
export const updateShiftStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Shift Not Found");
    }

    const shift = await Shift.findById(id);

    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    // Validate status
    const validStatuses = ["Approved", "Pending", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
      );
    }

    // Update shift status
    shift.status = status;
    const updatedShift = await shift.save();

    res.json({
      message: `Shift ${status.toLowerCase()} successfully`,
      shift: updatedShift,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete shift
// @route           DELETE /api/shifts/:id
// @access          Admin
export const deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Shift Not Found");
    }

    const shift = await Shift.findById(id);

    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    // Check if shift is assigned to any employees (active assignments)
    const activeAssignmentCount = await EmployeeShift.countDocuments({
      shift: id,
      endDate: null,
    });
    if (activeAssignmentCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete shift with ${activeAssignmentCount} active employee(s) assigned. Please reassign employees first.`,
      );
    }

    await shift.deleteOne();

    res.json({
      message: "Shift deleted successfully",
      deletedShift: {
        id: shift._id,
        name: shift.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
