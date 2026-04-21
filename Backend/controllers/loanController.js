import Loan from "../models/Loan.js";
import Employee from "../models/Employee.js";
import mongoose from "mongoose";
import { formatInTimeZone } from "date-fns-tz";
import { PAKISTAN_TZ } from "../utils/timezone.js";

// ── Helpers ──

const round2 = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Floor to whole number — no decimals in installments */
const floorInt = (value) => Math.floor(Number(value));

/**
 * Get the next month {year, month} after a given date (Pakistan TZ).
 */
const getNextMonth = (fromDate = new Date()) => {
  const pkMonth = Number(formatInTimeZone(fromDate, PAKISTAN_TZ, "M"));
  const pkYear = Number(formatInTimeZone(fromDate, PAKISTAN_TZ, "yyyy"));
  if (pkMonth === 12) return { year: pkYear + 1, month: 1 };
  return { year: pkYear, month: pkMonth + 1 };
};

/**
 * Build repayment schedule for a loan starting from {startYear, startMonth}.
 */
const buildRepaymentSchedule = ({
  loanAmount,
  repaymentType,
  monthlyInstallment,
  totalMonths,
  startYear,
  startMonth,
}) => {
  const schedule = [];
  let remaining = loanAmount;
  let y = startYear;
  let m = startMonth;

  if (repaymentType === "fixed_amount") {
    const base = floorInt(monthlyInstallment);
    while (remaining > 0) {
      const amt = remaining <= base ? remaining : base;
      schedule.push({ year: y, month: m, amount: amt, actualAmount: 0, status: "Pending" });
      remaining -= amt;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  } else if (repaymentType === "fixed_months") {
    const base = floorInt(loanAmount / totalMonths);
    for (let i = 0; i < totalMonths; i++) {
      const isLast = i === totalMonths - 1;
      const amt = isLast ? remaining : base;
      schedule.push({ year: y, month: m, amount: amt, actualAmount: 0, status: "Pending" });
      remaining -= amt;
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  } else if (repaymentType === "next_salary") {
    // Single entry — full amount. If net salary at payroll time cannot cover it,
    // payrollService will handle partial and extend the schedule.
    schedule.push({
      year: y,
      month: m,
      amount: loanAmount,
      actualAmount: 0,
      status: "Pending",
    });
  }

  return schedule;
};

// ── GET /api/loans ──

export const getLoans = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = (req.query.search || "").trim();
    const department = (req.query.department || "").trim();
    const position = (req.query.position || "").trim();
    const status = (req.query.status || "").trim();
    const year = req.query.year ? Number(req.query.year) : null;
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
        $unwind: { path: "$employeePosition", preserveNullAndEmptyArrays: true },
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
        $unwind: { path: "$employeeDepartment", preserveNullAndEmptyArrays: true },
      },
    ];

    if (searchText) {
      pipeline.push({
        $match: {
          $or: [
            { "employee.fullName": { $regex: searchText, $options: "i" } },
            { "employee.employeeID": { $regex: searchText, $options: "i" } },
          ],
        },
      });
    }

    if (department) {
      pipeline.push({
        $match: { "employeeDepartment.name": { $regex: department, $options: "i" } },
      });
    }

    if (position) {
      pipeline.push({
        $match: { "employeePosition.name": { $regex: position, $options: "i" } },
      });
    }

    if (status) {
      pipeline.push({ $match: { status } });
    }

    if (year) {
      pipeline.push({ $match: { $expr: { $eq: [{ $year: "$createdAt" }, year] } } });
    }

    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Loan.aggregate(countPipeline);
    const totalLoans = countResult[0]?.total || 0;

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
        loanAmount: 1,
        repaymentType: 1,
        monthlyInstallment: 1,
        totalMonths: 1,
        totalPaid: 1,
        remainingBalance: 1,
        reason: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const loans = await Loan.aggregate(pipeline);

    res.json({
      loans,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLoans / limit),
        totalLoans,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/loans/search-employees ──

export const searchEmployeesForLoan = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

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

    // Check active loans for each
    const employeeIds = employees.map((e) => e._id);
    const activeLoans = await Loan.find({
      employee: { $in: employeeIds },
      status: { $in: ["Pending", "Approved"] },
    })
      .select("employee")
      .lean();

    const activeLoanEmployeeIds = new Set(
      activeLoans.map((l) => l.employee.toString()),
    );

    const result = employees.map((e) => ({
      ...e,
      hasActiveLoan: activeLoanEmployeeIds.has(e._id.toString()),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/loans/:id ──

export const getLoanDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Loan not found");
    }

    const loan = await Loan.findById(id)
      .populate({
        path: "employee",
        select: "fullName employeeID position",
        populate: {
          path: "position",
          select: "name department",
          populate: { path: "department", select: "name" },
        },
      })
      .populate("approvedBy", "name email")
      .lean();

    if (!loan) {
      res.status(404);
      throw new Error("Loan not found");
    }

    res.json({ loan });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/loans ──

export const createLoan = async (req, res, next) => {
  try {
    const { employees, loanAmount, repaymentType, monthlyInstallment, totalMonths, reason } =
      req.body || {};

    // Validate employees array
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      res.status(400);
      throw new Error("At least one employee is required");
    }

    for (const empId of employees) {
      if (!mongoose.Types.ObjectId.isValid(empId)) {
        res.status(400);
        throw new Error(`Invalid employee ID: ${empId}`);
      }
    }

    // Validate loan amount
    if (loanAmount === undefined || loanAmount === null) {
      res.status(400);
      throw new Error("Loan amount is required");
    }
    const parsedAmount = Number(loanAmount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || !Number.isInteger(parsedAmount)) {
      res.status(400);
      throw new Error("Loan amount must be a whole number (no decimals)");
    }

    // Validate repayment type
    if (!["fixed_amount", "fixed_months", "next_salary"].includes(repaymentType)) {
      res.status(400);
      throw new Error("Repayment type must be fixed_amount, fixed_months, or next_salary");
    }

    // Validate type-specific params
    let computedInstallment = 0;
    let computedMonths = null;

    if (repaymentType === "fixed_amount") {
      const parsed = Number(monthlyInstallment);
      if (!parsed || parsed <= 0 || !Number.isInteger(parsed)) {
        res.status(400);
        throw new Error("Monthly installment must be a positive whole number");
      }
      if (parsed > parsedAmount) {
        res.status(400);
        throw new Error("Monthly installment cannot exceed loan amount");
      }
      computedInstallment = floorInt(parsed);
      computedMonths = Math.ceil(parsedAmount / computedInstallment);
    } else if (repaymentType === "fixed_months") {
      const parsed = Number(totalMonths);
      if (!Number.isInteger(parsed) || parsed < 1) {
        res.status(400);
        throw new Error("Total months must be a positive integer");
      }
      computedMonths = parsed;
      computedInstallment = floorInt(parsedAmount / parsed);
    } else {
      // next_salary — installment is full amount
      computedInstallment = floorInt(parsedAmount);
      computedMonths = null;
    }

    const isAdmin = req.user?.role === "admin";

    // Verify employees + check active loans
    const createdLoans = [];
    const errors = [];

    for (const empId of employees) {
      const employeeDoc = await Employee.findById(empId);
      if (!employeeDoc) {
        errors.push({ employee: empId, message: "Employee not found" });
        continue;
      }
      if (employeeDoc.status !== "Active") {
        errors.push({ employee: empId, message: "Employee is not active" });
        continue;
      }

      // Check existing active loan
      const activeLoan = await Loan.findOne({
        employee: empId,
        status: { $in: ["Pending", "Approved"] },
      });
      if (activeLoan) {
        errors.push({
          employee: empId,
          message: `${employeeDoc.fullName} already has an active loan`,
        });
        continue;
      }

      const status = isAdmin ? "Approved" : "Pending";
      const start = getNextMonth();

      const loanDoc = {
        employee: empId,
        loanAmount: floorInt(parsedAmount),
        repaymentType,
        monthlyInstallment: computedInstallment,
        totalMonths: computedMonths,
        remainingBalance: floorInt(parsedAmount),
        reason: reason?.trim() || "",
        status,
        createdBy: req.user?._id || null,
      };

      if (isAdmin) {
        loanDoc.approvedBy = req.user?._id || null;
        loanDoc.approvedAt = new Date();
        loanDoc.repaymentSchedule = buildRepaymentSchedule({
          loanAmount: floorInt(parsedAmount),
          repaymentType,
          monthlyInstallment: computedInstallment,
          totalMonths: computedMonths,
          startYear: start.year,
          startMonth: start.month,
        });
      }

      const created = await Loan.create(loanDoc);
      createdLoans.push(created._id);
    }

    if (createdLoans.length === 0 && errors.length > 0) {
      res.status(400);
      throw new Error(errors[0].message);
    }

    res.status(201).json({
      count: createdLoans.length,
      errors,
      message:
        errors.length > 0
          ? `${createdLoans.length} loan(s) created. ${errors.length} failed.`
          : `${createdLoans.length} loan(s) created successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/loans/:id/approve ──

export const approveLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Loan not found");
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      res.status(404);
      throw new Error("Loan not found");
    }

    if (loan.status !== "Pending") {
      res.status(400);
      throw new Error("Only pending loans can be approved");
    }

    const start = getNextMonth();
    loan.status = "Approved";
    loan.approvedBy = req.user?._id || null;
    loan.approvedAt = new Date();
    loan.repaymentSchedule = buildRepaymentSchedule({
      loanAmount: loan.loanAmount,
      repaymentType: loan.repaymentType,
      monthlyInstallment: loan.monthlyInstallment,
      totalMonths: loan.totalMonths,
      startYear: start.year,
      startMonth: start.month,
    });

    await loan.save();

    res.json({ loan, message: "Loan approved successfully" });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/loans/:id/reject ──

export const rejectLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Loan not found");
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      res.status(404);
      throw new Error("Loan not found");
    }

    if (loan.status !== "Pending") {
      res.status(400);
      throw new Error("Only pending loans can be rejected");
    }

    loan.status = "Rejected";
    await loan.save();

    res.json({ loan, message: "Loan rejected" });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/loans/:id/settle ──

export const settleLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Loan not found");
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      res.status(404);
      throw new Error("Loan not found");
    }

    if (loan.status !== "Approved") {
      res.status(400);
      throw new Error("Only approved loans can be settled");
    }

    if (loan.remainingBalance <= 0) {
      res.status(400);
      throw new Error("Loan is already fully paid");
    }

    // Mark all pending installments as skipped
    loan.repaymentSchedule = loan.repaymentSchedule.map((entry) =>
      entry.status === "Pending"
        ? { ...entry.toObject ? entry.toObject() : entry, status: "Skipped", actualAmount: 0 }
        : entry.toObject ? entry.toObject() : entry,
    );

    loan.totalPaid = floorInt(loan.loanAmount);
    loan.remainingBalance = 0;
    loan.status = "Completed";
    loan.completedAt = new Date();

    await loan.save();

    res.json({ loan, message: "Loan settled early. Remaining balance cleared." });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/loans/:id ──

export const deleteLoan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Loan not found");
    }

    const loan = await Loan.findById(id);
    if (!loan) {
      res.status(404);
      throw new Error("Loan not found");
    }

    if (loan.status === "Approved" && loan.totalPaid > 0) {
      res.status(400);
      throw new Error(
        "Cannot delete an approved loan with payments already made. Use early settlement instead.",
      );
    }

    if (loan.status === "Completed") {
      res.status(400);
      throw new Error("Cannot delete a completed loan");
    }

    await Loan.deleteOne({ _id: loan._id });

    res.json({ message: "Loan deleted successfully" });
  } catch (err) {
    next(err);
  }
};
