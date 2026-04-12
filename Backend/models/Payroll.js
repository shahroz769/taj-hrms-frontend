import mongoose from "mongoose";

const payrollErrorSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
    },
    reasonCode: {
      type: String,
      required: true,
    },
    reasonMessage: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const salarySegmentSchema = new mongoose.Schema(
  {
    startDate: Date,
    endDate: Date,
    basicSalary: Number,
    allowancePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowancePolicy",
      default: null,
    },
    allowanceAmount: Number,
    payableDayUnits: Number,
    segmentBasicAmount: Number,
    segmentAllowanceAmount: Number,
  },
  { _id: false },
);

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeSnapshot: {
      employeeID: String,
      fullName: String,
      basicSalary: Number,
      joiningDate: Date,
      resignationDate: Date,
      positionName: String,
      departmentName: String,
      status: String,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    currency: {
      type: String,
      default: "PKR",
    },
    workingDays: {
      totalScheduled: { type: Number, default: 0 },
      present: { type: Number, default: 0 },
      absences: { type: Number, default: 0 },
      leaves: { type: Number, default: 0 },
      paidLeaves: { type: Number, default: 0 },
      unpaidLeaves: { type: Number, default: 0 },
      halfDay: { type: Number, default: 0 },
      late: { type: Number, default: 0 },
    },
    salarySegments: {
      type: [salarySegmentSchema],
      default: [],
    },
    calculations: {
      calculationVersion: { type: String, default: "v1" },
      calendarDaysInMonth: { type: Number, default: 0 },
      grossSalary: { type: Number, default: 0 },
      fullBasicSalaryAmount: { type: Number, default: 0 },
      fullAllowanceAmount: { type: Number, default: 0 },
      basicSalaryAmount: { type: Number, default: 0 },
      allowanceAmount: { type: Number, default: 0 },
      basicSalaryDeductionAmount: { type: Number, default: 0 },
      allowanceDeductionAmount: { type: Number, default: 0 },
      attendanceDeductionAmount: { type: Number, default: 0 },
      attendanceDeductionDayUnits: { type: Number, default: 0 },
      allowanceRatio: { type: Number, default: 0 },
      payableDayUnits: { type: Number, default: 0 },
      latePenaltyBasicAmount: { type: Number, default: 0 },
      latePenaltyAllowanceAmount: { type: Number, default: 0 },
      latePenaltyAmount: { type: Number, default: 0 },
      lateCount: { type: Number, default: 0 },
      latePenaltyGroups: { type: Number, default: 0 },
      manualDeductionAmount: { type: Number, default: 0 },
      loanDeductionAmount: { type: Number, default: 0 },
      arrearsAmount: { type: Number, default: 0 },
      earnedBasic: { type: Number, default: 0 },
      paidLeaveAmount: { type: Number, default: 0 },
      halfDayDeduction: { type: Number, default: 0 },
      perDaySalary: { type: Number, default: 0 },
      scheduledDays: { type: Number, default: 0 },
      netSalary: { type: Number, default: 0 },
      totalSalary: { type: Number, default: 0 },
    },
    attendanceDeductionBreakdown: {
      type: [
        {
          key: String,
          label: String,
          count: Number,
          basicAmount: Number,
          allowanceAmount: Number,
          totalAmount: Number,
        },
      ],
      default: [],
    },
    deductionBreakdown: {
      type: [
        {
          deduction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Deduction",
            default: null,
          },
          reason: String,
          amount: Number,
          date: Date,
          status: {
            type: String,
            enum: ["deducted", "pending"],
            default: "deducted",
          },
          sourceDueYear: Number,
          sourceDueMonth: Number,
          deferredToYear: Number,
          deferredToMonth: Number,
        },
      ],
      default: [],
    },
    allowanceBreakdown: {
      type: [
        {
          name: String,
          amount: Number,
        },
      ],
      default: [],
    },
    loanDeductionBreakdown: {
      type: [
        {
          loan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Loan",
          },
          installmentAmount: Number,
          installmentNumber: Number,
          totalInstallments: Number,
          remainingBalance: Number,
        },
      ],
      default: [],
    },
    arrearsLedgerEntries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayrollArrearsLedger",
      },
    ],
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generationMode: {
      type: String,
      enum: ["normal", "force", "regenerate"],
      default: "normal",
    },
    overwrittenPayrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
    },
    overwriteAudit: {
      overwrittenPayrollId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payroll",
        default: null,
      },
      overwrittenAt: {
        type: Date,
        default: null,
      },
      overwrittenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

payrollSchema.index({ employee: 1, year: 1, month: 1 }, { unique: true });
payrollSchema.index({ year: 1, month: 1, createdAt: -1 });
payrollSchema.index({
  "employeeSnapshot.fullName": "text",
  "employeeSnapshot.employeeID": "text",
});

const Payroll = mongoose.model("Payroll", payrollSchema);

export { payrollErrorSchema };
export default Payroll;
