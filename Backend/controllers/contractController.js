import Contract from "../models/Contract.js";
import ContractAttendance from "../models/ContractAttendance.js";
import ContractPayment from "../models/ContractPayment.js";
import mongoose from "mongoose";

/**
 * Calculate total days between two dates (inclusive)
 */
const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  return diffDays;
};

/**
 * @route   POST /api/contracts
 * @desc    Create a new contract
 * @access  Admin
 */
export const createContract = async (req, res, next) => {
  try {
    const {
      contractName,
      startDate,
      endDate,
      numberOfLabors,
      contractAmount,
    } = req.body;

    // Validate required fields
    if (!contractName?.trim()) {
      res.status(400);
      throw new Error("Contract name is required");
    }

    if (!startDate) {
      res.status(400);
      throw new Error("Start date is required");
    }

    if (!endDate) {
      res.status(400);
      throw new Error("End date is required");
    }

    if (!numberOfLabors || numberOfLabors < 1) {
      res.status(400);
      throw new Error("Number of labors must be at least 1");
    }

    if (!Number.isInteger(numberOfLabors)) {
      res.status(400);
      throw new Error("Number of labors must be an integer");
    }

    if (!contractAmount || contractAmount < 0) {
      res.status(400);
      throw new Error("Contract amount must be a positive number");
    }

    if (!Number.isInteger(contractAmount)) {
      res.status(400);
      throw new Error("Contract amount must be an integer");
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      res.status(400);
      throw new Error("End date must be after start date");
    }

    // Check for duplicate contract name (case-insensitive)
    const existingContract = await Contract.findOne({
      contractName: { $regex: new RegExp(`^${contractName.trim()}$`, "i") },
    });

    if (existingContract) {
      res.status(400);
      throw new Error("Contract with this name already exists");
    }

    // Calculate total days and per labor cost per day
    const totalDays = calculateTotalDays(startDate, endDate);
    const perLaborCostPerDay = contractAmount / (totalDays * numberOfLabors);

    // Create contract
    const contract = await Contract.create({
      contractName: contractName.trim(),
      startDate,
      endDate,
      numberOfLabors,
      contractAmount,
      status: "Active",
      perLaborCostPerDay,
      totalDays,
      totalDaysWorked: 0,
      createdBy: req.user.name || req.user.email,
    });

    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contracts
 * @desc    Get all contracts with pagination and aggregated amounts
 * @access  Admin
 */
export const getAllContracts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const searchText = req.query.search || "";
    const statusFilter = req.query.status || "";

    // Build search query
    const query = {};
    
    if (searchText) {
      query.contractName = { $regex: searchText, $options: "i" };
    }
    
    if (statusFilter) {
      query.status = statusFilter;
    }

    // Get contracts with pagination
    const contracts = await Contract.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const totalItems = await Contract.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    // Aggregate attendance and payment data for each contract
    const contractsWithAmounts = await Promise.all(
      contracts.map(async (contract) => {
        // Get total incurred amount (sum of attendance day costs)
        const attendanceResult = await ContractAttendance.aggregate([
          { $match: { contractId: contract._id } },
          { $group: { _id: null, total: { $sum: "$dayCost" } } },
        ]);

        const totalIncurredAmount =
          attendanceResult.length > 0 ? attendanceResult[0].total : 0;

        // Get total amount paid (sum of payments)
        const paymentResult = await ContractPayment.aggregate([
          { $match: { contractId: contract._id } },
          { $group: { _id: null, total: { $sum: "$amountPaid" } } },
        ]);

        const totalAmountPaid =
          paymentResult.length > 0 ? paymentResult[0].total : 0;

        // Get total days worked (count of attendance records)
        const totalDaysWorked = await ContractAttendance.countDocuments({
          contractId: contract._id,
        });

        return {
          ...contract.toObject(),
          totalIncurredAmount,
          totalAmountPaid,
          totalDaysWorked,
        };
      })
    );

    res.status(200).json({
      contracts: contractsWithAmounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contracts/:id
 * @desc    Get contract by ID with aggregated amounts
 * @access  Admin
 */
export const getContractById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Get total incurred amount (sum of attendance day costs)
    const attendanceResult = await ContractAttendance.aggregate([
      { $match: { contractId: contract._id } },
      { $group: { _id: null, total: { $sum: "$dayCost" } } },
    ]);

    const totalIncurredAmount =
      attendanceResult.length > 0 ? attendanceResult[0].total : 0;

    // Get total amount paid (sum of payments)
    const paymentResult = await ContractPayment.aggregate([
      { $match: { contractId: contract._id } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const totalAmountPaid =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    // Get total days worked (count of attendance records)
    const totalDaysWorked = await ContractAttendance.countDocuments({
      contractId: contract._id,
    });

    res.status(200).json({
      ...contract.toObject(),
      totalIncurredAmount,
      totalAmountPaid,
      totalDaysWorked,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/contracts/:id
 * @desc    Update contract
 * @access  Admin
 */
export const updateContract = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      contractName,
      startDate,
      endDate,
      numberOfLabors,
      contractAmount,
      status,
    } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Validate required fields
    if (!contractName?.trim()) {
      res.status(400);
      throw new Error("Contract name is required");
    }

    if (!startDate) {
      res.status(400);
      throw new Error("Start date is required");
    }

    if (!endDate) {
      res.status(400);
      throw new Error("End date is required");
    }

    if (!numberOfLabors || numberOfLabors < 1) {
      res.status(400);
      throw new Error("Number of labors must be at least 1");
    }

    if (!Number.isInteger(numberOfLabors)) {
      res.status(400);
      throw new Error("Number of labors must be an integer");
    }

    if (!contractAmount || contractAmount < 0) {
      res.status(400);
      throw new Error("Contract amount must be a positive number");
    }

    if (!Number.isInteger(contractAmount)) {
      res.status(400);
      throw new Error("Contract amount must be an integer");
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      res.status(400);
      throw new Error("End date must be after start date");
    }

    // Check for duplicate contract name (excluding current contract)
    if (contractName.trim() !== contract.contractName) {
      const existingContract = await Contract.findOne({
        contractName: { $regex: new RegExp(`^${contractName.trim()}$`, "i") },
        _id: { $ne: id },
      });

      if (existingContract) {
        res.status(400);
        throw new Error("Contract with this name already exists");
      }
    }

    // Calculate total days and per labor cost per day
    const totalDays = calculateTotalDays(startDate, endDate);
    const perLaborCostPerDay = contractAmount / (totalDays * numberOfLabors);

    // Check if perLaborCostPerDay has changed (using small epsilon for floating point comparison)
    const epsilon = 0.0001;
    const perLaborCostChanged =
      Math.abs(contract.perLaborCostPerDay - perLaborCostPerDay) > epsilon;

    // Validate status if provided
    if (status && !["Active", "Completed", "Suspended"].includes(status)) {
      res.status(400);
      throw new Error("Invalid status. Must be Active, Completed, or Suspended");
    }

    // Update contract fields
    contract.contractName = contractName.trim();
    contract.startDate = startDate;
    contract.endDate = endDate;
    contract.numberOfLabors = numberOfLabors;
    contract.contractAmount = contractAmount;
    contract.perLaborCostPerDay = perLaborCostPerDay;
    contract.totalDays = totalDays;
    
    // Update status if provided
    if (status) {
      contract.status = status;
      if (status === "Suspended") {
        contract.suspendedDate = new Date();
      } else if (status === "Active") {
        contract.suspendedDate = null;
      }
    }

    await contract.save();

    // If perLaborCostPerDay changed, recalculate all attendance day costs
    if (perLaborCostChanged) {
      const attendances = await ContractAttendance.find({ contractId: id });

      if (attendances.length > 0) {
        // Update each attendance record with recalculated day cost
        const updatePromises = attendances.map((attendance) => {
          attendance.dayCost = attendance.laborersPresent * perLaborCostPerDay;
          return attendance.save();
        });

        await Promise.all(updatePromises);
      }
    }

    res.status(200).json(contract);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/contracts/:id/status
 * @desc    Update contract status
 * @access  Admin
 */
export const updateContractStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    // Validate status
    if (!["Active", "Completed", "Suspended"].includes(status)) {
      res.status(400);
      throw new Error("Invalid status. Must be Active, Completed, or Suspended");
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Get total days worked from attendance
    const totalDaysWorked = await ContractAttendance.countDocuments({
      contractId: contract._id,
    });

    // Update status and related fields
    contract.status = status;
    contract.totalDaysWorked = totalDaysWorked;

    if (status === "Suspended") {
      contract.suspendedDate = new Date();
    } else if (status === "Active") {
      // Clear suspended date when resuming
      contract.suspendedDate = null;
    }

    await contract.save();

    res.status(200).json({
      message: `Contract status updated to ${status}`,
      contract,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/contracts/:id
 * @desc    Delete contract
 * @access  Admin
 */
export const deleteContract = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid contract ID");
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      res.status(404);
      throw new Error("Contract not found");
    }

    // Check for dependencies - attendance records
    const attendanceCount = await ContractAttendance.countDocuments({
      contractId: id,
    });

    if (attendanceCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete contract. It has ${attendanceCount} attendance record(s). Please delete attendance records first.`
      );
    }

    // Check for dependencies - payment records
    const paymentCount = await ContractPayment.countDocuments({
      contractId: id,
    });

    if (paymentCount > 0) {
      res.status(400);
      throw new Error(
        `Cannot delete contract. It has ${paymentCount} payment record(s). Please delete payment records first.`
      );
    }

    await contract.deleteOne();

    res.status(200).json({
      message: "Contract deleted successfully",
      contract: {
        _id: contract._id,
        contractName: contract.contractName,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contracts/list
 * @desc    Get simple list of contracts for dropdown
 * @access  Admin
 */
export const getContractsList = async (req, res, next) => {
  try {
    const contracts = await Contract.find()
      .select("_id contractName status")
      .sort({ contractName: 1 });

    res.status(200).json(contracts);
  } catch (error) {
    next(error);
  }
};
