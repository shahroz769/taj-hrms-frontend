import Deduction from "../models/Deduction.js";
import Employee from "../models/Employee.js";
import Payroll from "../models/Payroll.js";
import mongoose from "mongoose";
import { formatInTimeZone } from "date-fns-tz";
import { PAKISTAN_TZ } from "../utils/timezone.js";

// @description     Get all deductions (paginated, with filters)
// @route           GET /api/deductions
// @access          Admin, Supervisor
export const getDeductions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = (req.query.search || "").trim();
    const department = (req.query.department || "").trim();
    const position = (req.query.position || "").trim();
    const year = req.query.year ? Number(req.query.year) : null;
    const month = req.query.month ? Number(req.query.month) : null;

    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $lookup: {
          from: "positions",
          localField: "employee.position",
          foreignField: "_id",
          as: "employeePosition",
        },
      },
      {
        $unwind: {
          path: "$employeePosition",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "employeePosition.department",
          foreignField: "_id",
          as: "employeeDepartment",
        },
      },
      {
        $unwind: {
          path: "$employeeDepartment",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Search filter
    if (searchText) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employee.fullName": {
                $regex: searchText,
                $options: "i",
              },
            },
            {
              "employee.employeeID": {
                $regex: searchText,
                $options: "i",
              },
            },
          ],
        },
      });
    }

    // Department filter
    if (department) {
      pipeline.push({
        $match: {
          "employeeDepartment.name": {
            $regex: department,
            $options: "i",
          },
        },
      });
    }

    // Position filter
    if (position) {
      pipeline.push({
        $match: {
          "employeePosition.name": {
            $regex: position,
            $options: "i",
          },
        },
      });
    }

    // Year/Month filter on deduction date
    if (year || month) {
      const dateMatch = {};
      if (year) {
        dateMatch.$expr = dateMatch.$expr || { $and: [] };
        dateMatch.$expr.$and.push({
          $eq: [{ $year: "$date" }, year],
        });
      }
      if (month) {
        dateMatch.$expr = dateMatch.$expr || { $and: [] };
        dateMatch.$expr.$and.push({
          $eq: [{ $month: "$date" }, month],
        });
      }
      pipeline.push({ $match: dateMatch });
    }

    // Count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Deduction.aggregate(countPipeline);
    const totalDeductions = countResult[0]?.total || 0;

    // Fetch paginated
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 1,
        "employee._id": 1,
        "employee.fullName": 1,
        "employee.employeeID": 1,
        "employeePosition.name": 1,
        "employeeDepartment.name": 1,
        amount: 1,
        date: 1,
        reason: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const deductions = await Deduction.aggregate(pipeline);

    res.json({
      deductions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDeductions / limit),
        totalDeductions,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Search employees for deduction form
// @route           GET /api/deductions/search-employees?q=
// @access          Admin, Supervisor
export const searchEmployeesForDeduction = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json([]);
    }

    const employees = await Employee.find({
      status: "Active",
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { employeeID: { $regex: q, $options: "i" } },
      ],
    })
      .select("fullName employeeID")
      .limit(10)
      .lean();

    res.json(employees);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create deduction(s)
// @route           POST /api/deductions
// @access          Admin
export const createDeduction = async (req, res, next) => {
  try {
    const { employees, amount, date, reason } = req.body || {};

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      res.status(400);
      throw new Error("At least one employee is required");
    }

    for (const empId of employees) {
      if (!mongoose.Types.ObjectId.isValid(empId)) {
        res.status(400);
        throw new Error(`Invalid employee ID: ${empId}`);
      }
      const employeeDoc = await Employee.findById(empId);
      if (!employeeDoc) {
        res.status(404);
        throw new Error("Employee not found");
      }
    }

    if (amount === undefined || amount === null) {
      res.status(400);
      throw new Error("Amount is required");
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400);
      throw new Error("Amount must be a positive number greater than zero");
    }

    if (!date) {
      res.status(400);
      throw new Error("Date is required");
    }

    // Validate date is not in the past (Pakistan timezone)
    const deductionDate = new Date(date);
    const todayInPK = formatInTimeZone(new Date(), PAKISTAN_TZ, "yyyy-MM-dd");
    const deductionDateInPK = formatInTimeZone(
      deductionDate,
      PAKISTAN_TZ,
      "yyyy-MM-dd",
    );

    if (deductionDateInPK < todayInPK) {
      res.status(400);
      throw new Error(
        "Deduction date cannot be in the past. Please select today or a future date.",
      );
    }

    if (!reason?.trim()) {
      res.status(400);
      throw new Error("Reason is required");
    }

    const createdDeductions = [];
    for (const empId of employees) {
      const newDeduction = new Deduction({
        employee: empId,
        amount: parsedAmount,
        date: deductionDate,
        reason: reason.trim(),
        createdBy: req.user?._id || null,
      });
      const saved = await newDeduction.save();
      createdDeductions.push(saved._id);
    }

    res
      .status(201)
      .json({ count: createdDeductions.length, message: "Deduction(s) created successfully" });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update deduction
// @route           PUT /api/deductions/:id
// @access          Admin
export const updateDeduction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Deduction not found");
    }

    const deduction = await Deduction.findById(id);
    if (!deduction) {
      res.status(404);
      throw new Error("Deduction not found");
    }

    const { employee, amount, date, reason } = req.body || {};

    if (employee) {
      if (!mongoose.Types.ObjectId.isValid(employee)) {
        res.status(400);
        throw new Error("Invalid employee ID");
      }
      const employeeDoc = await Employee.findById(employee);
      if (!employeeDoc) {
        res.status(404);
        throw new Error("Employee not found");
      }
      deduction.employee = employee;
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        res.status(400);
        throw new Error("Amount must be a positive number greater than zero");
      }
      deduction.amount = parsedAmount;
    }

    if (date) {
      deduction.date = new Date(date);
    }

    if (reason !== undefined) {
      if (!reason?.trim()) {
        res.status(400);
        throw new Error("Reason is required");
      }
      deduction.reason = reason.trim();
    }

    const updatedDeduction = await deduction.save();

    // Check if payroll exists for the month of this deduction
    const deductionDate = new Date(updatedDeduction.date);
    const deductionYear = deductionDate.getUTCFullYear();
    const deductionMonth = deductionDate.getUTCMonth() + 1;

    const existingPayroll = await Payroll.findOne({
      employee: updatedDeduction.employee,
      year: deductionYear,
      month: deductionMonth,
    });

    const populatedDeduction = await Deduction.findById(updatedDeduction._id)
      .populate("employee", "fullName employeeID");

    res.json({
      deduction: populatedDeduction,
      payrollExists: !!existingPayroll,
      message: existingPayroll
        ? "Deduction updated. Payroll exists for this month — please regenerate payroll to reflect changes."
        : "Deduction updated successfully",
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete deduction
// @route           DELETE /api/deductions/:id
// @access          Admin
export const deleteDeduction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Deduction not found");
    }

    const deduction = await Deduction.findById(id).populate(
      "employee",
      "fullName employeeID",
    );

    if (!deduction) {
      res.status(404);
      throw new Error("Deduction not found");
    }

    // Check if payroll exists for the month of this deduction
    const deductionDate = new Date(deduction.date);
    const deductionYear = deductionDate.getUTCFullYear();
    const deductionMonth = deductionDate.getUTCMonth() + 1;

    const existingPayroll = await Payroll.findOne({
      employee: deduction.employee._id,
      year: deductionYear,
      month: deductionMonth,
    });

    await deduction.deleteOne();

    res.json({
      message: existingPayroll
        ? "Deduction deleted. Payroll exists for this month — please regenerate payroll to reflect changes."
        : "Deduction deleted successfully",
      payrollExists: !!existingPayroll,
      deletedDeduction: {
        id: deduction._id,
        employee: deduction.employee?.fullName,
        amount: deduction.amount,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
