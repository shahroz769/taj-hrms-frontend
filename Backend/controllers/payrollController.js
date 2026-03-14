import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Payroll from "../models/Payroll.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import AllowancePolicy from "../models/AllowancePolicy.js";
import {
  isMonthClosedInPakistanTime,
  getMonthStartEndUtcForPakistan,
} from "../utils/timezone.js";
import {
  calculateEmployeePayroll,
  settleArrearsForPayroll,
  rollbackArrearsSettledByPayroll,
} from "../services/payrollService.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const parsePagination = (req) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
  };
};

const getEligibleEmployeeIds = async ({ year, month }) => {
  const { monthStartUtc, nextMonthStartUtc } = getMonthStartEndUtcForPakistan(
    year,
    month,
  );

  const activeEmployees = await Employee.find({
    status: "Active",
    $or: [{ joiningDate: null }, { joiningDate: { $lt: nextMonthStartUtc } }],
  }).select("_id");

  const attendanceEmployees = await Attendance.distinct("employee", {
    date: { $gte: monthStartUtc, $lt: nextMonthStartUtc },
  });

  const arrearsEmployees = await PayrollArrearsLedger.distinct("employee", {
    settled: false,
  });

  return [
    ...new Set([
      ...activeEmployees.map((item) => item._id.toString()),
      ...attendanceEmployees.map((item) => item.toString()),
      ...arrearsEmployees.map((item) => item.toString()),
    ]),
  ];
};

const validateYearMonth = (year, month, res) => {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 3000) {
    res.status(400);
    throw new Error("Invalid year");
  }

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    res.status(400);
    throw new Error("Invalid month");
  }

  if (!isMonthClosedInPakistanTime(parsedYear, parsedMonth)) {
    res.status(400);
    throw new Error(
      "Payroll can be generated only for months fully closed in Pakistan time (Asia/Karachi)",
    );
  }

  return { parsedYear, parsedMonth };
};

const buildPayrollError = (
  employee,
  year,
  month,
  reasonCode,
  reasonMessage,
) => ({
  employeeId: employee?._id || null,
  employeeName: employee?.fullName || "Unknown Employee",
  year,
  month,
  reasonCode,
  reasonMessage,
});

const runPayrollMutationForEmployee = async ({
  employee,
  year,
  month,
  generatedBy,
  mode,
}) => {
  const session = await mongoose.startSession();

  try {
    let createdPayroll = null;

    await session.withTransaction(async () => {
      const existingPayroll = await Payroll.findOne({
        employee: employee._id,
        year,
        month,
      }).session(session);

      let overwrittenPayrollId = null;
      if (existingPayroll) {
        overwrittenPayrollId = existingPayroll._id;
        await rollbackArrearsSettledByPayroll(existingPayroll._id, session);
        await Payroll.deleteOne({ _id: existingPayroll._id }, { session });
      }

      const payload = await calculateEmployeePayroll({
        employee,
        year,
        month,
        generatedBy,
        mode,
        includeArrears: true,
        skipArrearsSync: false,
        AllowancePolicyModel: AllowancePolicy,
        session,
      });

      payload.overwrittenPayrollId = overwrittenPayrollId;
      payload.overwriteAudit = overwrittenPayrollId
        ? {
            overwrittenPayrollId,
            overwrittenAt: new Date(),
            overwrittenBy: generatedBy || null,
          }
        : null;

      const createdRows = await Payroll.create([payload], { session });
      createdPayroll = createdRows[0];

      await settleArrearsForPayroll({
        payrollId: createdPayroll._id,
        arrearsLedgerEntryIds: payload.arrearsLedgerEntries,
        session,
      });
    });

    return createdPayroll;
  } finally {
    await session.endSession();
  }
};

// @description     List payrolls with filters
// @route           GET /api/payrolls
// @access          Admin, Supervisor
export const getPayrolls = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req);
    const search = (req.query.search || "").trim();
    const month = Number(req.query.month || 0);
    const year = Number(req.query.year || 0);
    const department = (req.query.department || "").trim();
    const position = (req.query.position || "").trim();

    const query = {};

    if (year) query.year = year;
    if (month) query.month = month;

    if (department) {
      query["employeeSnapshot.departmentName"] = {
        $regex: department,
        $options: "i",
      };
    }

    if (position) {
      query["employeeSnapshot.positionName"] = {
        $regex: position,
        $options: "i",
      };
    }

    if (search) {
      query.$or = [
        { "employeeSnapshot.fullName": { $regex: search, $options: "i" } },
        { "employeeSnapshot.employeeID": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Payroll.find(query)
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payroll.countDocuments(query),
    ]);

    res.json({
      payrolls: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @description     Preview payroll generation eligible employee count
// @route           GET /api/payrolls/preview
// @access          Admin
export const previewPayrollGeneration = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const parsedYear = Number(year);
    const parsedMonth = Number(month);

    if (!Number.isInteger(parsedYear) || !Number.isInteger(parsedMonth)) {
      res.status(400);
      throw new Error("Year and month are required");
    }

    const employeeIds = await getEligibleEmployeeIds({
      year: parsedYear,
      month: parsedMonth,
    });

    res.json({
      year: parsedYear,
      month: parsedMonth,
      eligibleEmployeesCount: employeeIds.length,
      monthClosed: isMonthClosedInPakistanTime(parsedYear, parsedMonth),
    });
  } catch (error) {
    next(error);
  }
};

// @description     Generate payroll for all eligible employees in selected month
// @route           POST /api/payrolls/generate
// @access          Admin
export const generatePayrolls = async (req, res, next) => {
  try {
    const { year, month, forceReplace = false } = req.body || {};
    const { parsedYear, parsedMonth } = validateYearMonth(year, month, res);

    const employeeIds = await getEligibleEmployeeIds({
      year: parsedYear,
      month: parsedMonth,
    });

    const employees = await Employee.find({ _id: { $in: employeeIds } })
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate({
        path: "allowancePolicy",
        populate: { path: "components.allowanceComponent", select: "name" },
      });

    const errors = [];
    const generatedPayrolls = [];

    for (const employee of employees) {
      try {
        const existingPayroll = await Payroll.findOne({
          employee: employee._id,
          year: parsedYear,
          month: parsedMonth,
        });

        if (existingPayroll && !forceReplace) {
          errors.push(
            buildPayrollError(
              employee,
              parsedYear,
              parsedMonth,
              "PAYROLL_EXISTS",
              "Payroll already exists for this employee and month",
            ),
          );
          continue;
        }

        const created = await runPayrollMutationForEmployee({
          employee,
          year: parsedYear,
          month: parsedMonth,
          generatedBy: req.user?._id || null,
          mode: forceReplace ? "force" : "normal",
        });

        generatedPayrolls.push(created);
      } catch (error) {
        errors.push(
          buildPayrollError(
            employee,
            parsedYear,
            parsedMonth,
            "GENERATION_FAILED",
            error.message || "Failed to generate payroll",
          ),
        );
      }
    }

    res.json({
      message: "Payroll generation completed",
      year: parsedYear,
      month: parsedMonth,
      summary: {
        totalEligible: employees.length,
        generated: generatedPayrolls.length,
        failed: errors.length,
      },
      errors,
    });
  } catch (error) {
    next(error);
  }
};

// @description     Regenerate single employee payroll
// @route           POST /api/payrolls/:employeeId/regenerate
// @access          Admin
export const regenerateEmployeePayroll = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const { parsedYear, parsedMonth } = validateYearMonth(year, month, res);

    const employee = await Employee.findById(employeeId)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate({
        path: "allowancePolicy",
        populate: { path: "components.allowanceComponent", select: "name" },
      });

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const created = await runPayrollMutationForEmployee({
      employee,
      year: parsedYear,
      month: parsedMonth,
      generatedBy: req.user?._id || null,
      mode: "regenerate",
    });

    res.json({
      message: "Payroll regenerated successfully",
      payroll: created,
    });
  } catch (error) {
    next(error);
  }
};

// @description     Get payroll details by ID
// @route           GET /api/payrolls/:id
// @access          Admin, Supervisor
export const getPayrollById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    const payroll = await Payroll.findById(id).populate(
      "arrearsLedgerEntries",
      "sourceYear sourceMonth amount reason",
    );

    if (!payroll) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    res.json(payroll);
  } catch (error) {
    next(error);
  }
};

// @description     Get payslip payload
// @route           GET /api/payrolls/:id/payslip
// @access          Admin, Supervisor
export const getPayslipPayload = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    const payroll = await Payroll.findById(id).populate(
      "arrearsLedgerEntries",
      "sourceYear sourceMonth amount reason",
    );

    if (!payroll) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    res.json({
      payslip: payroll,
      monthName: MONTH_NAMES[payroll.month - 1],
    });
  } catch (error) {
    next(error);
  }
};

// @description     Download payslip PDF
// @route           GET /api/payrolls/:id/payslip/pdf
// @access          Admin, Supervisor
export const downloadPayslipPdf = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    const payroll = await Payroll.findById(id).populate(
      "arrearsLedgerEntries",
      "sourceYear sourceMonth amount reason",
    );

    if (!payroll) {
      res.status(404);
      throw new Error("Payroll not found");
    }

    const monthName = MONTH_NAMES[payroll.month - 1];

    const filename = `${payroll.employeeSnapshot.employeeID || "employee"}-${payroll.year}-${String(
      payroll.month,
    ).padStart(2, "0")}-payslip.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);

    doc.fontSize(18).text("Payslip", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text(`Employee: ${payroll.employeeSnapshot.fullName}`);
    doc.text(`Position: ${payroll.employeeSnapshot.positionName}`);
    doc.text(`Department: ${payroll.employeeSnapshot.departmentName}`);

    doc.moveUp(3);
    doc.text(`${monthName} ${payroll.year}`, { align: "right" });
    doc.text(`Employee ID: ${payroll.employeeSnapshot.employeeID}`, {
      align: "right",
    });
    doc.text(
      `Joining Date: ${payroll.employeeSnapshot.joiningDate ? new Date(payroll.employeeSnapshot.joiningDate).toLocaleDateString() : "-"}`,
      { align: "right" },
    );

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Attendance Summary");
    doc.font("Helvetica").fontSize(11);
    doc.text(
      `Working Days: ${payroll.workingDays.totalScheduled}    Present: ${payroll.workingDays.present}    Absent: ${payroll.workingDays.absences}`,
    );
    doc.text(
      `Leaves: ${payroll.workingDays.leaves} (Paid: ${payroll.workingDays.paidLeaves || 0}, Unpaid: ${payroll.workingDays.unpaidLeaves || 0})    Half Day: ${payroll.workingDays.halfDay}    Late: ${payroll.workingDays.late}`,
    );
    doc.moveDown(1);

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    doc.font("Helvetica-Bold").fontSize(12).text("Earnings");
    doc.font("Helvetica").fontSize(11);
    doc.text(
      `Basic Salary: PKR ${Number(payroll.calculations.basicSalaryAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );

    if (payroll.allowanceBreakdown?.length) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(10).text("Allowances:");
      doc.font("Helvetica").fontSize(11);
      payroll.allowanceBreakdown.forEach((item) => {
        doc.text(
          `  ${item.name}: PKR ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        );
      });
    }

    if (Number(payroll.calculations.arrearsAmount || 0) !== 0) {
      doc.text(
        `Arrears: PKR ${Number(payroll.calculations.arrearsAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      );
    }

    doc.moveDown(0.5);
    doc.font("Helvetica-Bold");
    doc.text(
      `Gross Salary: PKR ${Number(payroll.calculations.grossSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
    doc.font("Helvetica");

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // Deductions section
    const hasLatePenalty = Number(payroll.calculations.latePenaltyAmount || 0) > 0;
    const hasManualDeductions = Number(payroll.calculations.manualDeductionAmount || 0) > 0;

    if (hasLatePenalty || hasManualDeductions) {
      doc.font("Helvetica-Bold").fontSize(12).text("Deductions");
      doc.font("Helvetica").fontSize(11);

      if (hasLatePenalty) {
        doc.text(
          `Late Penalty: PKR ${Number(payroll.calculations.latePenaltyAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        );
      }

      if (hasManualDeductions && payroll.deductionBreakdown?.length) {
        payroll.deductionBreakdown.forEach((item) => {
          doc.text(
            `  ${item.reason}: PKR ${Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          );
        });
      } else if (hasManualDeductions) {
        doc.text(
          `Manual Deductions: PKR ${Number(payroll.calculations.manualDeductionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        );
      }

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);
    }

    doc.font("Helvetica-Bold").fontSize(14);
    doc.text(
      `Total Salary: PKR ${Number(payroll.calculations.totalSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );
    doc.font("Helvetica");

    doc.end();
  } catch (error) {
    next(error);
  }
};
