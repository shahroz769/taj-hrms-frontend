import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Payroll from "../models/Payroll.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import AllowancePolicy from "../models/AllowancePolicy.js";
import Loan from "../models/Loan.js";
import Deduction from "../models/Deduction.js";
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

const TAJ_LOGO_PATH = fileURLToPath(
  new URL("../assets/taj-logo.png", import.meta.url),
);

const formatCurrency = (value) =>
  `PKR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const sumAmounts = (items = [], key = "amount") =>
  items.reduce((sum, item) => sum + Number(item?.[key] || 0), 0);

const getAttendanceCountByKey = (payroll, key) => {
  switch (key) {
    case "absent":
      return Number(payroll?.workingDays?.absences || 0);
    case "unpaidLeave":
      return Number(payroll?.workingDays?.unpaidLeaves || 0);
    case "halfDay":
      return Number(payroll?.workingDays?.halfDay || 0);
    default:
      return 0;
  }
};

const getAttendanceLabelByKey = (key) => {
  switch (key) {
    case "absent":
      return "Absent";
    case "unpaidLeave":
      return "Unpaid Leave";
    case "halfDay":
      return "Half Day";
    default:
      return "Attendance";
  }
};

const resolveFullBasicSalaryAmount = (payroll) =>
  Number(payroll?.employeeSnapshot?.basicSalary || 0) ||
  Math.max(
    0,
    ...(payroll?.salarySegments || []).map((segment) =>
      Number(segment?.basicSalary || 0),
    ),
  ) ||
  Number(payroll?.calculations?.fullBasicSalaryAmount || 0) ||
  Number(payroll?.calculations?.basicSalaryAmount || 0);

const resolveFullAllowanceAmount = (payroll) =>
  sumAmounts(payroll?.allowanceBreakdown || []) ||
  Number(payroll?.calculations?.fullAllowanceAmount || 0);

const resolveEmploymentAdjustment = () => {
  return {
    isMidJoin: false,
    isMidLeft: false,
    label: "",
    meta: "",
    basicAmount: 0,
    allowanceAmount: 0,
    totalAmount: 0,
  };
};

const resolveAttendanceDeductionBreakdown = ({
  payroll,
  fullBasicSalaryAmount,
  fullAllowanceAmount,
}) => {
  if ((payroll?.attendanceDeductionBreakdown || []).length > 0) {
    return payroll.attendanceDeductionBreakdown.map((item) => ({
      ...item,
      label: item.label || getAttendanceLabelByKey(item.key),
      count:
        item.count ?? item.days ?? getAttendanceCountByKey(payroll, item.key),
      basicAmount: Number(item.basicAmount || 0),
      allowanceAmount: Number(item.allowanceAmount || 0),
      totalAmount: Number(item.totalAmount || 0),
    }));
  }

  const totalScheduledDays = Number(
    payroll?.calculations?.calendarDaysInMonth ||
      payroll?.workingDays?.totalScheduled ||
      0,
  );
  const basicPerScheduledDay =
    totalScheduledDays > 0 ? fullBasicSalaryAmount / totalScheduledDays : 0;
  const allowancePerScheduledDay =
    totalScheduledDays > 0 ? fullAllowanceAmount / totalScheduledDays : 0;

  return [
    {
      key: "absent",
      label: "Absent",
      count: Number(payroll?.workingDays?.absences || 0),
      basicAmount:
        basicPerScheduledDay * Number(payroll?.workingDays?.absences || 0),
      allowanceAmount:
        allowancePerScheduledDay * Number(payroll?.workingDays?.absences || 0),
    },
    {
      key: "unpaidLeave",
      label: "Unpaid Leave",
      count: Number(payroll?.workingDays?.unpaidLeaves || 0),
      basicAmount:
        basicPerScheduledDay * Number(payroll?.workingDays?.unpaidLeaves || 0),
      allowanceAmount:
        allowancePerScheduledDay *
        Number(payroll?.workingDays?.unpaidLeaves || 0),
    },
    {
      key: "halfDay",
      label: "Half Day",
      count: Number(payroll?.workingDays?.halfDay || 0),
      basicAmount:
        basicPerScheduledDay * Number(payroll?.workingDays?.halfDay || 0) * 0.5,
      allowanceAmount:
        allowancePerScheduledDay *
        Number(payroll?.workingDays?.halfDay || 0) *
        0.5,
    },
  ]
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      basicAmount: Number(item.basicAmount.toFixed(2)),
      allowanceAmount: Number(item.allowanceAmount.toFixed(2)),
      totalAmount: Number((item.basicAmount + item.allowanceAmount).toFixed(2)),
    }));
};

const drawWatermark = (doc) => {
  if (!existsSync(TAJ_LOGO_PATH)) return;
  const imageWidth = 150;
  const imageX = (doc.page.width - imageWidth) / 2;
  const imageY = (doc.page.height - imageWidth) / 2 - 20;
  doc.save();
  doc.opacity(0.08);
  doc.image(TAJ_LOGO_PATH, imageX, imageY, { width: imageWidth });
  doc.restore();
};

const ensureSpace = (doc, neededHeight, margin = 36) => {
  if (doc.y + neededHeight <= doc.page.height - margin) return;
  doc.addPage();
  drawWatermark(doc);
  doc.y = margin;
};

const drawSectionHeading = (doc, label) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111111")
    .text(label.toUpperCase(), 36, doc.y, { width: doc.page.width - 72 });
  doc.moveDown(0.15);
  doc
    .strokeColor("#d4d4d4")
    .moveTo(36, doc.y)
    .lineTo(doc.page.width - 36, doc.y)
    .stroke();
  doc.moveDown(0.5);
};

const drawInfoGrid = (doc, items) => {
  const startX = 36;
  const startY = doc.y;
  const totalWidth = doc.page.width - 72;
  const columnGap = 12;
  const columnWidth = (totalWidth - columnGap) / 2;
  const rowHeight = 34;

  items.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = startX + column * (columnWidth + columnGap);
    const y = startY + row * (rowHeight + 10);

    doc
      .fillColor("#666666")
      .font("Helvetica")
      .fontSize(9)
      .text(item.label, x, y + 2, { width: columnWidth });
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(item.value, x, y + 14, { width: columnWidth });
  });

  doc.y = startY + Math.ceil(items.length / 2) * (rowHeight + 10);
};

const drawStatCards = (doc, items) => {
  const startX = 36;
  const startY = doc.y;
  const totalWidth = doc.page.width - 72;
  const gap = 8;
  const cardWidth = (totalWidth - gap * 3) / 4;
  const cardHeight = 54;

  items.forEach((item, index) => {
    const x = startX + index * (cardWidth + gap);
    const y = startY;
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(String(item.value), x, y + 8, { width: cardWidth, align: "center" });
    doc
      .fillColor("#666666")
      .font("Helvetica")
      .fontSize(9)
      .text(item.label, x + 8, y + 26, { width: cardWidth - 16, align: "center" });
    if (item.meta?.length) {
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .fontSize(8)
        .text(item.meta, x + 8, y + 36, { width: cardWidth - 16, align: "center" });
    }
  });

  doc.y = startY + cardHeight + 16;
};

const measureBreakdownHeight = (rows) =>
  rows.reduce((sum, row) => sum + (row.meta ? 44 : 22), 16);

const drawBreakdownBox = (doc, rows) => {
  const x = 36;
  const width = doc.page.width - 72;
  const height = measureBreakdownHeight(rows);
  const startY = doc.y;

  let cursorY = startY + 4;
  rows.forEach((row, index) => {
    const rowTopY = cursorY;
    doc
      .fillColor("#111111")
      .font(row.emphasis ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.emphasis ? 11 : 10)
      .text(row.label, x + 14, rowTopY, { width: width - 180 });
    doc
      .fillColor(row.negative ? "#111111" : "#111111")
      .font(row.emphasis ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.emphasis ? 11 : 10)
      .text(row.value, x + width - 150, rowTopY, {
        width: 136,
        align: "right",
      });

    if (row.meta) {
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .fontSize(8.5)
        .text(row.meta, x + 14, rowTopY + 14, { width: width - 180 });
      cursorY = rowTopY + 30;
    } else {
      cursorY = rowTopY + 14;
    }

    if (index < rows.length - 1) {
      doc
        .strokeColor("#e5e5e5")
        .moveTo(x, cursorY)
        .lineTo(x + width, cursorY)
        .stroke();
      cursorY += 8;
    }
  });

  doc.y = startY + height + 10;
};

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
      "Payroll can be generated only for months fully closed.",
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

        if (existingPayroll.deductionBreakdown?.length > 0) {
          for (const deductionEntry of existingPayroll.deductionBreakdown) {
            if (!deductionEntry.deduction) continue;
            const deduction = await Deduction.findById(deductionEntry.deduction).session(session);
            if (!deduction) continue;

            deduction.status = "Pending";
            deduction.deductedAt = null;
            deduction.deductedByPayroll = null;
            deduction.currentDueYear =
              deductionEntry.sourceDueYear ||
              deduction.originalDueYear ||
              year;
            deduction.currentDueMonth =
              deductionEntry.sourceDueMonth ||
              deduction.originalDueMonth ||
              month;
            await deduction.save({ session });
          }
        }

        // Reverse previous loan deduction if any
        if (existingPayroll.loanDeductionBreakdown?.length > 0) {
          for (const loanEntry of existingPayroll.loanDeductionBreakdown) {
            const prevLoan = await Loan.findById(loanEntry.loan).session(session);
            if (prevLoan) {
              prevLoan.totalPaid = Math.round(Math.max(0, prevLoan.totalPaid - loanEntry.installmentAmount) * 100) / 100;
              prevLoan.remainingBalance = Math.round((prevLoan.remainingBalance + loanEntry.installmentAmount) * 100) / 100;
              if (prevLoan.status === "Completed" && prevLoan.remainingBalance > 0) {
                prevLoan.status = "Approved";
                prevLoan.completedAt = null;
              }
              const idx = prevLoan.repaymentSchedule.findIndex(
                (e) => e.year === year && e.month === month,
              );
              if (idx !== -1) {
                prevLoan.repaymentSchedule[idx].status = "Pending";
                prevLoan.repaymentSchedule[idx].actualAmount = 0;
              }
              await prevLoan.save({ session });
            }
          }
        }

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

      if (payload.deductionBreakdown?.length > 0) {
        for (const deductionEntry of payload.deductionBreakdown) {
          if (!deductionEntry.deduction) continue;
          const deduction = await Deduction.findById(deductionEntry.deduction).session(session);
          if (!deduction) continue;

          if (deductionEntry.status === "deducted") {
            deduction.status = "Deducted";
            deduction.deductedAt = new Date();
            deduction.deductedByPayroll = createdPayroll._id;
            deduction.currentDueYear =
              deductionEntry.sourceDueYear ||
              deduction.currentDueYear ||
              year;
            deduction.currentDueMonth =
              deductionEntry.sourceDueMonth ||
              deduction.currentDueMonth ||
              month;
          } else {
            deduction.status = "Pending";
            deduction.deductedAt = null;
            deduction.deductedByPayroll = null;
            deduction.currentDueYear =
              deductionEntry.deferredToYear ||
              deduction.currentDueYear ||
              year;
            deduction.currentDueMonth =
              deductionEntry.deferredToMonth ||
              deduction.currentDueMonth ||
              month;
          }

          await deduction.save({ session });
        }
      }

      // Update loan balance after payroll creation
      if (payload.loanDeductionBreakdown?.length > 0) {
        for (const loanEntry of payload.loanDeductionBreakdown) {
          const loan = await Loan.findById(loanEntry.loan).session(session);
          if (loan) {
            loan.totalPaid = Math.round((loan.totalPaid + loanEntry.installmentAmount) * 100) / 100;
            loan.remainingBalance = Math.round((loan.remainingBalance - loanEntry.installmentAmount) * 100) / 100;

            // Update schedule entry
            const idx = loan.repaymentSchedule.findIndex(
              (e) => e.year === year && e.month === month,
            );
            if (idx !== -1) {
              const scheduled = loan.repaymentSchedule[idx].amount;
              loan.repaymentSchedule[idx].actualAmount = loanEntry.installmentAmount;
              loan.repaymentSchedule[idx].status =
                loanEntry.installmentAmount >= scheduled ? "Paid" : "Partial";
            }

            // Carry any unpaid remainder forward if the schedule has no future pending installment.
            if (loan.remainingBalance > 0) {
              const hasFuturePending = loan.repaymentSchedule.some(
                (e) =>
                  e.status === "Pending" &&
                  (e.year > year || (e.year === year && e.month > month)),
              );
              if (!hasFuturePending) {
                let nextM = month + 1;
                let nextY = year;
                if (nextM > 12) { nextM = 1; nextY += 1; }
                loan.repaymentSchedule.push({
                  year: nextY,
                  month: nextM,
                  amount: loan.remainingBalance,
                  actualAmount: 0,
                  status: "Pending",
                });
              }
            }

            // Check if fully paid
            if (loan.remainingBalance <= 0) {
              loan.status = "Completed";
              loan.completedAt = new Date();
              loan.remainingBalance = 0;
            }

            await loan.save({ session });
          }
        }
      }
    });

    return createdPayroll;
  } finally {
    await session.endSession();
  }
};

// @description     Monthly payroll summary (aggregated by year+month)
// @route           GET /api/payrolls/monthly-summary
// @access          Admin, Supervisor
export const getPayrollMonthlySummary = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req);
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const year = Number(req.query.year || 0);
    const month = Number(req.query.month || 0);

    const matchStage = {};
    if (year) matchStage.year = year;
    if (month) matchStage.month = month;
    if (search) {
      matchStage.$or = [
        { "employeeSnapshot.fullName": { $regex: search, $options: "i" } },
        { "employeeSnapshot.employeeID": { $regex: search, $options: "i" } },
      ];
    }

    const pipeline = [];
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          totalEmployees: { $sum: 1 },
          totalGrossSalary: { $sum: "$calculations.grossSalary" },
          totalNetSalary: { $sum: "$calculations.netSalary" },
          paidCount: {
            $sum: { $cond: [{ $eq: ["$isPaid", true] }, 1, 0] },
          },
          unpaidCount: {
            $sum: { $cond: [{ $ne: ["$isPaid", true] }, 1, 0] },
          },
          totalPaidAmount: {
            $sum: {
              $cond: [
                { $eq: ["$isPaid", true] },
                "$calculations.netSalary",
                0,
              ],
            },
          },
          totalUnpaidAmount: {
            $sum: {
              $cond: [
                { $ne: ["$isPaid", true] },
                "$calculations.netSalary",
                0,
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    );

    const rows = await Payroll.aggregate(pipeline);
    const facetResult = rows[0] || { metadata: [], data: [] };
    const total = facetResult.metadata[0]?.total || 0;
    const summaries = facetResult.data.map((r) => ({
      year: r._id.year,
      month: r._id.month,
      monthLabel: MONTH_NAMES[r._id.month - 1] || "-",
      totalEmployees: r.totalEmployees,
      totalGrossSalary: r.totalGrossSalary,
      totalNetSalary: r.totalNetSalary,
      paidCount: r.paidCount,
      unpaidCount: r.unpaidCount,
      totalPaidAmount: r.totalPaidAmount,
      totalUnpaidAmount: r.totalUnpaidAmount,
    }));

    res.json({
      summaries,
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

// @description     Generate payroll for all eligible employees in selected month (SSE streaming)
// @route           POST /api/payrolls/generate
// @access          Admin
export const generatePayrolls = async (req, res, next) => {
  try {
    const { year, month, forceReplace = false } = req.body || {};

    // Validate before setting SSE headers so HTTP errors work correctly
    const { parsedYear, parsedMonth } = validateYearMonth(year, month, res);

    // Set Server-Sent Events headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });

    const sendEvent = (data) => {
      if (clientDisconnected) return;
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
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

      const existingPayrolls = await Payroll.find({
        employee: { $in: employeeIds },
        year: parsedYear,
        month: parsedMonth,
      })
        .select("_id employee isPaid")
        .lean();

      const existingPayrollMap = new Map(
        existingPayrolls.map((payroll) => [payroll.employee.toString(), payroll]),
      );

      const total = employees.length;
      const errors = [];
      const generatedPayrolls = [];

      for (let i = 0; i < employees.length; i++) {
        if (clientDisconnected) break;

        const employee = employees[i];

        sendEvent({
          type: "processing",
          processed: i,
          total,
          percent: Math.round((i / Math.max(total, 1)) * 100),
          currentEmployee: employee.fullName,
        });

        try {
          const existingPayroll =
            existingPayrollMap.get(employee._id.toString()) || null;

          if (existingPayroll && existingPayroll.isPaid) {
            errors.push(
              buildPayrollError(
                employee,
                parsedYear,
                parsedMonth,
                "PAYROLL_PAID",
                "Cannot regenerate a paid payroll",
              ),
            );
            continue;
          }

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

      sendEvent({
        type: "complete",
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
    } catch (innerError) {
      sendEvent({
        type: "error",
        message: innerError.message || "Payroll generation failed",
      });
    }

    res.end();
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

    const existingPayroll = await Payroll.findOne({
      employee: employeeId,
      year: parsedYear,
      month: parsedMonth,
    });

    if (existingPayroll && existingPayroll.isPaid) {
      res.status(400);
      throw new Error("Cannot regenerate a paid payroll");
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
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    doc.pipe(res);
    drawWatermark(doc);

    const fullBasicSalaryAmount = resolveFullBasicSalaryAmount(payroll);
    const fullAllowanceAmount = resolveFullAllowanceAmount(payroll);
    const employmentAdjustment = resolveEmploymentAdjustment({
      payroll,
      fullBasicSalaryAmount,
      fullAllowanceAmount,
    });
    const attendanceDeductionBreakdown = resolveAttendanceDeductionBreakdown({
      payroll,
      fullBasicSalaryAmount,
      fullAllowanceAmount,
    });

    const displayedLateCount =
      Number(payroll.calculations?.lateCount || 0) ||
      Number(payroll.workingDays?.late || 0);
    const displayedLatePenaltyGroups =
      Number(payroll.calculations?.latePenaltyGroups || 0) ||
      Math.floor(displayedLateCount / 3);
    const latePenaltyBasicAmount = Number(
      payroll.calculations?.latePenaltyBasicAmount || 0,
    );
    const latePenaltyAllowanceAmount = Number(
      payroll.calculations?.latePenaltyAllowanceAmount || 0,
    );
    const attendanceBasicDeduction = sumAmounts(
      attendanceDeductionBreakdown,
      "basicAmount",
    );
    const attendanceAllowanceDeduction = sumAmounts(
      attendanceDeductionBreakdown,
      "allowanceAmount",
    );
    const displayedBasicDeduction =
      attendanceBasicDeduction +
      latePenaltyBasicAmount +
      employmentAdjustment.basicAmount;
    const displayedAllowanceDeduction =
      attendanceAllowanceDeduction +
      latePenaltyAllowanceAmount +
      employmentAdjustment.allowanceAmount;
    const attendanceDeductionAmount =
      Number(payroll.calculations?.attendanceDeductionAmount || 0) ||
      sumAmounts(attendanceDeductionBreakdown, "totalAmount");
    const latePenaltyAmount = Number(payroll.calculations?.latePenaltyAmount || 0);
    const deductedManualBreakdown = (payroll.deductionBreakdown || []).filter(
      (item) => item.status === "deducted",
    );
    const pendingManualBreakdown = (payroll.deductionBreakdown || []).filter(
      (item) => item.status === "pending",
    );
    const manualDeductionAmount = Number(
      payroll.calculations?.manualDeductionAmount || 0,
    );
    const loanDeductionAmount = Number(
      payroll.calculations?.loanDeductionAmount || 0,
    );
    const totalDeductions =
      attendanceDeductionAmount +
      latePenaltyAmount +
      manualDeductionAmount +
      loanDeductionAmount +
      employmentAdjustment.totalAmount;
    const presentCount =
      Number(payroll?.workingDays?.present || 0) +
      Number(payroll?.workingDays?.late || 0) +
      Number(payroll?.workingDays?.halfDay || 0);

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111827")
      .text("Payslip", 36, 36, {
        width: doc.page.width - 72,
        align: "center",
      });
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#6b7280")
      .text(`${monthName} ${payroll.year}`, 36, 60, {
        width: doc.page.width - 72,
        align: "center",
      });
    doc.y = 92;

    ensureSpace(doc, 120);
    drawInfoGrid(doc, [
      {
        label: "Employee",
        value: `${payroll.employeeSnapshot.fullName || "-"} (${payroll.employeeSnapshot.employeeID || "-"})`,
      },
      {
        label: "Position",
        value: payroll.employeeSnapshot.positionName || "-",
      },
      {
        label: "Joining Date",
        value: formatDisplayDate(payroll.employeeSnapshot.joiningDate),
      },
      {
        label: "Department",
        value: payroll.employeeSnapshot.departmentName || "-",
      },
      {
        label: "Net Salary",
        value: formatCurrency(
          payroll.calculations?.netSalary || payroll.calculations?.totalSalary,
        ),
      },
    ]);

    ensureSpace(doc, 90);
    drawSectionHeading(doc, "Attendance");
    drawStatCards(doc, [
      {
        label: "Working Days",
        value: payroll.workingDays?.totalScheduled ?? 0,
      },
      {
        label: "Present",
        value: presentCount,
        meta: `Half Day ${payroll.workingDays?.halfDay ?? 0} | Late ${payroll.workingDays?.late ?? 0}`,
      },
      {
        label: "Leave",
        value: payroll.workingDays?.leaves ?? 0,
        meta: `Paid ${payroll.workingDays?.paidLeaves ?? 0} | Unpaid ${payroll.workingDays?.unpaidLeaves ?? 0}`,
      },
      {
        label: "Absent",
        value: payroll.workingDays?.absences ?? 0,
      },
    ]);

    const salaryRows = [
      {
        label: "Basic Salary",
        value: formatCurrency(fullBasicSalaryAmount),
      },
      ...(payroll.allowanceBreakdown || []).map((item) => ({
        label: item.name,
        value: formatCurrency(item.amount),
      })),
      ...(payroll.allowanceBreakdown?.length
        ? [
            {
              label: "Total Allowances",
              value: formatCurrency(fullAllowanceAmount),
              emphasis: true,
            },
          ]
        : []),
      {
        label: "Gross Salary",
        value: formatCurrency(fullBasicSalaryAmount + fullAllowanceAmount),
        emphasis: true,
      },
      ...(Number(payroll.calculations?.perDaySalary || 0) > 0
        ? [
            {
              label: "Per Day Salary",
              value: formatCurrency(payroll.calculations?.perDaySalary || 0),
            },
          ]
        : []),
      ...(Number(payroll.calculations?.arrearsAmount || 0) !== 0
        ? [
            {
              label: "Arrears",
              value: formatCurrency(payroll.calculations?.arrearsAmount || 0),
            },
          ]
        : []),
    ];

    ensureSpace(doc, measureBreakdownHeight(salaryRows) + 24);
    drawSectionHeading(doc, "Salary");
    drawBreakdownBox(doc, salaryRows);

    const deductionRows = [
      {
        label: "Deducted From Basic Salary",
        value: `-${formatCurrency(displayedBasicDeduction)}`,
        negative: true,
      },
      {
        label: "Deducted From Allowances",
        value: `-${formatCurrency(displayedAllowanceDeduction)}`,
        negative: true,
      },
      ...(employmentAdjustment.totalAmount > 0
        ? [
            {
              label: employmentAdjustment.label,
              meta: employmentAdjustment.meta,
              value: `-${formatCurrency(employmentAdjustment.totalAmount)}`,
              negative: true,
            },
          ]
        : []),
      ...attendanceDeductionBreakdown.map((item) => ({
        label: item.label,
        meta: `Count ${Number(item.count || 0)} | Basic ${formatCurrency(item.basicAmount)} | Allowances ${formatCurrency(item.allowanceAmount)}`,
        value: `-${formatCurrency(item.totalAmount)}`,
        negative: true,
      })),
      ...(latePenaltyAmount > 0
        ? [
            {
              label: "Late Penalty",
              meta: `${displayedLateCount} late marks | ${displayedLatePenaltyGroups} late penalty ${displayedLatePenaltyGroups === 1 ? "group" : "groups"}`,
              value: `-${formatCurrency(latePenaltyAmount)}`,
              negative: true,
            },
          ]
        : []),
      ...(manualDeductionAmount > 0 && deductedManualBreakdown.length
        ? deductedManualBreakdown.map((item) => ({
            label: item.reason || "Manual Deduction",
            value: `-${formatCurrency(item.amount)}`,
            negative: true,
          }))
        : manualDeductionAmount > 0
          ? [
              {
                label: "Manual Deduction",
                value: `-${formatCurrency(manualDeductionAmount)}`,
                negative: true,
              },
            ]
          : []),
      ...(pendingManualBreakdown.length
        ? pendingManualBreakdown.map((item) => ({
            label: `Pending Manual Deduction`,
            meta: `${item.reason || "Manual Deduction"} moved to ${MONTH_NAMES[(item.deferredToMonth || 1) - 1] || "-"} ${item.deferredToYear || "-"}`,
            value: formatCurrency(item.amount),
          }))
        : []),
      ...(loanDeductionAmount > 0 && payroll.loanDeductionBreakdown?.length
        ? payroll.loanDeductionBreakdown.map((entry) => ({
            label: `Loan Repayment (${entry.installmentNumber} of ${entry.totalInstallments})`,
            meta: `Remaining: ${formatCurrency(entry.remainingBalance)}`,
            value: `-${formatCurrency(entry.installmentAmount)}`,
            negative: true,
          }))
        : loanDeductionAmount > 0
          ? [
              {
                label: "Loan Repayment",
                value: `-${formatCurrency(loanDeductionAmount)}`,
                negative: true,
              },
            ]
          : []),
      {
        label: "Total Deductions",
        value: `-${formatCurrency(totalDeductions)}`,
        negative: true,
        emphasis: true,
      },
    ];

    ensureSpace(doc, measureBreakdownHeight(deductionRows) + 24);
    drawSectionHeading(doc, "Deductions");
    drawBreakdownBox(doc, deductionRows);

    ensureSpace(doc, 48);
    const netSalaryY = doc.y;
    doc
      .strokeColor("#d4d4d4")
      .moveTo(36, netSalaryY)
      .lineTo(doc.page.width - 36, netSalaryY)
      .stroke();
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text("Net Salary", 36, netSalaryY + 12, { width: 180 });
    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(13)
      .text(
        formatCurrency(
          payroll.calculations?.netSalary || payroll.calculations?.totalSalary,
        ),
        doc.page.width - 216,
        netSalaryY + 12,
        { width: 160, align: "right" },
      );
    doc.y = netSalaryY + 30;

    doc.end();
  } catch (error) {
    next(error);
  }
};


// @description     Mark payroll as paid
// @route           PATCH /api/payrolls/:id/mark-paid
// @access          Admin
export const markPayrollAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error('Payroll not found');
    }

    const payroll = await Payroll.findById(id);

    if (!payroll) {
      res.status(404);
      throw new Error('Payroll not found');
    }

    payroll.isPaid = true;
    payroll.paidAt = new Date();
    payroll.paidBy = req.user?._id || null;
    await payroll.save();

    res.json({ success: true, isPaid: payroll.isPaid, paidAt: payroll.paidAt });
  } catch (error) {
    next(error);
  }
};
