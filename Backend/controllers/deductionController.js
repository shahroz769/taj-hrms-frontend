import Deduction from "../models/Deduction.js";
import Employee from "../models/Employee.js";
import Payroll from "../models/Payroll.js";
import mongoose from "mongoose";
import { formatInTimeZone } from "date-fns-tz";
import { PAKISTAN_TZ } from "../utils/timezone.js";
import { ROLES } from "../utils/roles.js";

const ensureSupervisorCanManagePendingDeduction = (req, deduction, res) => {
  const isAdmin = req.user?.role === ROLES.admin;

  if (!isAdmin && deduction.status !== "Pending") {
    res.status(403);
    throw new Error(
      "Supervisors can only modify or delete deductions while they are pending approval",
    );
  }
};

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
        status: 1,
        originalDueYear: 1,
        originalDueMonth: 1,
        currentDueYear: 1,
        currentDueMonth: 1,
        deductedAt: 1,
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
// @access          Admin, Supervisor
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

    const isAdmin = req.user?.role === ROLES.admin;
    const createdDeductions = [];
    for (const empId of employees) {
      const dueYear = Number(formatInTimeZone(deductionDate, PAKISTAN_TZ, "yyyy"));
      const dueMonth = Number(formatInTimeZone(deductionDate, PAKISTAN_TZ, "M"));
      const newDeduction = new Deduction({
        employee: empId,
        amount: parsedAmount,
        date: deductionDate,
        reason: reason.trim(),
        status: isAdmin ? "Approved" : "Pending",
        originalDueYear: dueYear,
        originalDueMonth: dueMonth,
        currentDueYear: dueYear,
        currentDueMonth: dueMonth,
        createdBy: req.user?._id || null,
      });
      const saved = await newDeduction.save();
      createdDeductions.push(saved._id);
    }

    res
      .status(201)
      .json({
        count: createdDeductions.length,
        message: isAdmin
          ? "Deduction(s) created successfully"
          : "Deduction(s) created and submitted for admin approval",
      });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update deduction
// @route           PUT /api/deductions/:id
// @access          Admin, Supervisor
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
    if (deduction.status === "Deducted") {
      res.status(400);
      throw new Error("A paid deduction cannot be edited");
    }
    ensureSupervisorCanManagePendingDeduction(req, deduction, res);

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
      if (deduction.status !== "Deducted") {
        const dueYear = Number(
          formatInTimeZone(deduction.date, PAKISTAN_TZ, "yyyy"),
        );
        const dueMonth = Number(
          formatInTimeZone(deduction.date, PAKISTAN_TZ, "M"),
        );
        deduction.originalDueYear = dueYear;
        deduction.originalDueMonth = dueMonth;
        deduction.currentDueYear = dueYear;
        deduction.currentDueMonth = dueMonth;
      }
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
// @access          Admin, Supervisor
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
    if (deduction.status === "Deducted") {
      res.status(400);
      throw new Error("A paid deduction cannot be deleted");
    }
    ensureSupervisorCanManagePendingDeduction(req, deduction, res);

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

// @description     Update deduction status (Approve/Reject/Reset to Pending)
// @route           PATCH /api/deductions/:id/status
// @access          Admin
export const updateDeductionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

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

    if (deduction.status === "Deducted") {
      res.status(400);
      throw new Error("A deducted deduction cannot be manually re-approved or rejected");
    }

    const validStatuses = ["Pending", "Approved", "Rejected"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Valid statuses are: ${validStatuses.join(", ")}`,
      );
    }

    deduction.status = status;
    const updatedDeduction = await deduction.save();

    res.json({
      message: `Deduction ${status.toLowerCase()} successfully`,
      deduction: updatedDeduction,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
