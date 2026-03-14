import ContractPayment from "../models/ContractPayment.js";
import Contract from "../models/Contract.js";
import mongoose from "mongoose";

/**
 * @route   POST /api/contract-payments
 * @desc    Create a new payment record
 * @access  Admin
 */
export const createPayment = async (req, res, next) => {
  try {
    const { contractId, paymentDate, amountPaid, paymentNote } = req.body;

    // Validate required fields
    if (!contractId) {
      res.status(400);
      throw new Error("Contract ID is required");
    }

    if (!paymentDate) {
      res.status(400);
      throw new Error("Payment date is required");
    }

    if (amountPaid === undefined || amountPaid === null) {
      res.status(400);
      throw new Error("Payment amount is required");
    }

    if (amountPaid <= 0) {
      res.status(400);
      throw new Error("Payment amount must be greater than 0");
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

    // Calculate current total paid amount
    const paymentResult = await ContractPayment.aggregate([
      { $match: { contractId: new mongoose.Types.ObjectId(contractId) } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const currentTotalPaid =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    // Validate that new payment won't exceed contract amount
    const newTotalPaid = currentTotalPaid + amountPaid;

    if (newTotalPaid > contract.contractAmount) {
      res.status(400);
      throw new Error(
        `Payment amount exceeds contract limit. Contract amount: ${contract.contractAmount}, Already paid: ${currentTotalPaid}, Attempting to pay: ${amountPaid}, Would total: ${newTotalPaid}`
      );
    }

    // Create payment
    const payment = await ContractPayment.create({
      contractId,
      paymentDate,
      amountPaid,
      paymentNote: paymentNote || "",
      createdBy: req.user.name || req.user.email,
    });

    // Populate contract details
    await payment.populate("contractId", "contractName contractAmount");

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contract-payments/contract/:contractId
 * @desc    Get all payment records for a specific contract
 * @access  Admin
 */
export const getPaymentsByContract = async (req, res, next) => {
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
      dateFilter.paymentDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.paymentDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.paymentDate.$lte = end;
      }
    }

    // Build query
    const query = { contractId, ...dateFilter };

    // Get payment records
    let paymentsQuery = ContractPayment.find(query)
      .sort({ paymentDate: -1 })
      .populate("contractId", "contractName contractAmount");

    if (shouldPaginate) {
      paymentsQuery = paymentsQuery.skip(skip).limit(limit);
    }

    const payments = await paymentsQuery;

    // Get total count
    const totalItems = await ContractPayment.countDocuments(query);
    const totalPages = shouldPaginate ? Math.ceil(totalItems / limit) : 1;

    // Calculate total amount paid
    const paymentResult = await ContractPayment.aggregate([
      { $match: { contractId: new mongoose.Types.ObjectId(contractId) } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const totalAmountPaid =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    res.status(200).json({
      payments,
      totalAmountPaid,
      contractAmount: contract.contractAmount,
      remainingAmount: contract.contractAmount - totalAmountPaid,
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
 * @route   GET /api/contract-payments/:id
 * @desc    Get payment by ID
 * @access  Admin
 */
export const getPaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid payment ID");
    }

    const payment = await ContractPayment.findById(id).populate(
      "contractId",
      "contractName contractAmount"
    );

    if (!payment) {
      res.status(404);
      throw new Error("Payment record not found");
    }

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/contract-payments/:id
 * @desc    Update payment record
 * @access  Admin
 */
export const updatePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentDate, amountPaid, paymentNote } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid payment ID");
    }

    const payment = await ContractPayment.findById(id);

    if (!payment) {
      res.status(404);
      throw new Error("Payment record not found");
    }

    // Get contract details
    const contract = await Contract.findById(payment.contractId);

    if (!contract) {
      res.status(404);
      throw new Error("Associated contract not found");
    }

    // Validate fields
    if (!paymentDate) {
      res.status(400);
      throw new Error("Payment date is required");
    }

    if (amountPaid === undefined || amountPaid === null) {
      res.status(400);
      throw new Error("Payment amount is required");
    }

    if (amountPaid <= 0) {
      res.status(400);
      throw new Error("Payment amount must be greater than 0");
    }

    // Calculate current total paid amount (excluding this payment)
    const paymentResult = await ContractPayment.aggregate([
      {
        $match: {
          contractId: new mongoose.Types.ObjectId(payment.contractId),
          _id: { $ne: new mongoose.Types.ObjectId(id) },
        },
      },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const currentTotalPaid =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    // Validate that updated payment won't exceed contract amount
    const newTotalPaid = currentTotalPaid + amountPaid;

    if (newTotalPaid > contract.contractAmount) {
      res.status(400);
      throw new Error(
        `Payment amount exceeds contract limit. Contract amount: ${contract.contractAmount}, Already paid (excluding this): ${currentTotalPaid}, Attempting to pay: ${amountPaid}, Would total: ${newTotalPaid}`
      );
    }

    // Update payment
    payment.paymentDate = paymentDate;
    payment.amountPaid = amountPaid;
    payment.paymentNote = paymentNote || "";

    await payment.save();

    // Populate contract details
    await payment.populate("contractId", "contractName contractAmount");

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/contract-payments/:id
 * @desc    Delete payment record
 * @access  Admin
 */
export const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid payment ID");
    }

    const payment = await ContractPayment.findById(id);

    if (!payment) {
      res.status(404);
      throw new Error("Payment record not found");
    }

    await payment.deleteOne();

    res.status(200).json({
      message: "Payment record deleted successfully",
      payment: {
        _id: payment._id,
        paymentDate: payment.paymentDate,
        amountPaid: payment.amountPaid,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/contract-payments/summary/:contractId
 * @desc    Get payment summary for a contract
 * @access  Admin
 */
export const getPaymentSummary = async (req, res, next) => {
  try {
    const { contractId } = req.params;

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

    // Calculate total amount paid
    const paymentResult = await ContractPayment.aggregate([
      { $match: { contractId: new mongoose.Types.ObjectId(contractId) } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const totalAmountPaid =
      paymentResult.length > 0 ? paymentResult[0].total : 0;

    // Get payment count
    const paymentCount = await ContractPayment.countDocuments({ contractId });

    res.status(200).json({
      contractId: contract._id,
      contractName: contract.contractName,
      contractAmount: contract.contractAmount,
      totalAmountPaid,
      remainingAmount: contract.contractAmount - totalAmountPaid,
      paymentCount,
      percentagePaid: (totalAmountPaid / contract.contractAmount) * 100,
    });
  } catch (error) {
    next(error);
  }
};
