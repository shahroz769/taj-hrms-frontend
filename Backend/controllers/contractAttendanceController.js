import ContractAttendance from "../models/ContractAttendance.js";
import Contract from "../models/Contract.js";
import mongoose from "mongoose";

/**
 * @route   POST /api/contract-attendances
 * @desc    Create a new attendance record
 * @access  Admin
 */
export const createAttendance = async (req, res, next) => {
  try {
    const { contractId, date, laborersPresent } = req.body;

    // Validate required fields
    if (!contractId) {
      res.status(400);
      throw new Error("Contract ID is required");
    }

    if (!date) {
      res.status(400);
      throw new Error("Date is required");
    }

    if (laborersPresent === undefined || laborersPresent === null) {
      res.status(400);
      throw new Error("Number of laborers present is required");
    }

    if (laborersPresent < 0) {
      res.status(400);
      throw new Error("Number of laborers present cannot be negative");
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    // Check if contract exists
    const contract = await Contract.findById(contractId);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Check if contract is Active
    if (contract.status !== "Active") {
      res.status(400);
      throw new Error(
        `Cannot add attendance. Contract status is ${contract.status}. Only Active contracts can have attendance added.`
      );
    }

    // Validate date is within contract date range
    const attendanceDate = new Date(date);
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);

    // Set time to midnight for accurate date comparison
    attendanceDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (attendanceDate < startDate || attendanceDate > endDate) {
      res.status(400);
      throw new Error(
        `Attendance date must be between contract start date (${contract.startDate.toISOString().split("T")[0]}) and end date (${contract.endDate.toISOString().split("T")[0]})`
      );
    }

    // Check for duplicate attendance (same contract and date)
    const existingAttendance = await ContractAttendance.findOne({
      contractId,
      date: attendanceDate,
    });

    if (existingAttendance) {
      res.status(400);
      throw new Error("Attendance for this date already exists");
    }

    // Calculate day cost
    const dayCost = laborersPresent * contract.perLaborCostPerDay;

    // Create attendance
    const attendance = await ContractAttendance.create({
      contractId,
      date: attendanceDate,
      laborersPresent,
      dayCost,
    });

    // Populate contract details
    await attendance.populate("contractId", "contractName perLaborCostPerDay");

    res.status(201).json(attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contract-attendances/contract/:contractId
 * @desc    Get all attendance records for a specific contract
 * @access  Admin
 */
export const getAttendancesByContract = async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Support "All" option (limit = 0)
    const shouldPaginate = limit > 0;
    const skip = shouldPaginate ? (page - 1) * limit : 0;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    // Check if contract exists
    const contract = await Contract.findById(contractId);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Build date filter query
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.date.$lte = end;
      }
    }

    // Build query
    const query = { contractId, ...dateFilter };

    // Get attendance records
    let attendancesQuery = ContractAttendance.find(query)
      .sort({ date: -1 })
      .populate("contractId", "contractName perLaborCostPerDay");

    if (shouldPaginate) {
      attendancesQuery = attendancesQuery.skip(skip).limit(limit);
    }

    const attendances = await attendancesQuery;

    // Get total count
    const totalItems = await ContractAttendance.countDocuments(query);
    const totalPages = shouldPaginate ? Math.ceil(totalItems / limit) : 1;

    res.status(200).json({
      attendances,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit: shouldPaginate ? limit : totalItems,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contract-attendances/:id
 * @desc    Get attendance by ID
 * @access  Admin
 */
export const getAttendanceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid attendance ID");
    }

    const attendance = await ContractAttendance.findById(id).populate(
      "contractId",
      "contractName perLaborCostPerDay"
    );

    if (!attendance) {
      res.status(404);
      throw new Error("Attendance record not found");
    }

    res.status(200).json(attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/contract-attendances/:id
 * @desc    Update attendance record
 * @access  Admin
 */
export const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, laborersPresent } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid attendance ID");
    }

    const attendance = await ContractAttendance.findById(id);

    if (!attendance) {
      res.status(404);
      throw new Error("Attendance record not found");
    }

    // Get contract details
    const contract = await Contract.findById(attendance.contractId);

    if (!contract) {
      res.status(404);
      throw new Error("Associated contract not found");
    }

    // Validate fields
    if (!date) {
      res.status(400);
      throw new Error("Date is required");
    }

    if (laborersPresent === undefined || laborersPresent === null) {
      res.status(400);
      throw new Error("Number of laborers present is required");
    }

    if (laborersPresent < 0) {
      res.status(400);
      throw new Error("Number of laborers present cannot be negative");
    }

    // Validate date is within contract date range
    const attendanceDate = new Date(date);
    const startDate = new Date(contract.startDate);
    const endDate = new Date(contract.endDate);

    // Set time to midnight for accurate date comparison
    attendanceDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (attendanceDate < startDate || attendanceDate > endDate) {
      res.status(400);
      throw new Error(
        `Attendance date must be between contract start date (${contract.startDate.toISOString().split("T")[0]}) and end date (${contract.endDate.toISOString().split("T")[0]})`
      );
    }

    // Check for duplicate attendance if date is being changed
    const originalDate = new Date(attendance.date);
    originalDate.setHours(0, 0, 0, 0);

    if (attendanceDate.getTime() !== originalDate.getTime()) {
      const existingAttendance = await ContractAttendance.findOne({
        contractId: attendance.contractId,
        date: attendanceDate,
        _id: { $ne: id },
      });

      if (existingAttendance) {
        res.status(400);
        throw new Error("Attendance for this date already exists");
      }
    }

    // Recalculate day cost
    const dayCost = laborersPresent * contract.perLaborCostPerDay;

    // Update attendance
    attendance.date = attendanceDate;
    attendance.laborersPresent = laborersPresent;
    attendance.dayCost = dayCost;

    await attendance.save();

    // Populate contract details
    await attendance.populate("contractId", "contractName perLaborCostPerDay");

    res.status(200).json(attendance);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/contract-attendances/:id
 * @desc    Delete attendance record
 * @access  Admin
 */
export const deleteAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid attendance ID");
    }

    const attendance = await ContractAttendance.findById(id);

    if (!attendance) {
      res.status(404);
      throw new Error("Attendance record not found");
    }

    await attendance.deleteOne();

    res.status(200).json({
      message: "Attendance record deleted successfully",
      attendance: {
        _id: attendance._id,
        date: attendance.date,
        laborersPresent: attendance.laborersPresent,
      },
    });
  } catch (error) {
    next(error);
  }
};
