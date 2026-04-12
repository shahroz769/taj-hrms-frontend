import mongoose from "mongoose";

const repaymentInstallmentSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    amount: { type: Number, required: true, min: 0 },
    actualAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Partial", "Skipped"],
      default: "Pending",
    },
  },
  { _id: false },
);

const loanSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    loanAmount: {
      type: Number,
      required: true,
      min: [1, "Loan amount must be at least 1"],
    },
    repaymentType: {
      type: String,
      enum: ["fixed_amount", "fixed_months", "next_salary"],
      required: true,
    },
    monthlyInstallment: {
      type: Number,
      default: 0,
    },
    totalMonths: {
      type: Number,
      default: null,
    },
    repaymentSchedule: {
      type: [repaymentInstallmentSchema],
      default: [],
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Completed"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

loanSchema.index({ employee: 1, status: 1 });
// Payroll searches the approved loan containing a pending installment for a specific year/month.
loanSchema.index({
  employee: 1,
  status: 1,
  "repaymentSchedule.year": 1,
  "repaymentSchedule.month": 1,
  "repaymentSchedule.status": 1,
});
loanSchema.index({ createdAt: -1 });

const Loan = mongoose.model("Loan", loanSchema);

export default Loan;
