import mongoose from "mongoose";

const payrollArrearsLedgerSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    sourceYear: {
      type: Number,
      required: true,
    },
    sourceMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    reason: {
      type: String,
      default: "Backdated salary/allowance adjustment",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    settled: {
      type: Boolean,
      default: false,
    },
    settledByPayrollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

payrollArrearsLedgerSchema.index(
  { employee: 1, sourceYear: 1, sourceMonth: 1 },
  { unique: true }
);
payrollArrearsLedgerSchema.index({ employee: 1, settled: 1 });

const PayrollArrearsLedger = mongoose.model(
  "PayrollArrearsLedger",
  payrollArrearsLedgerSchema
);

export default PayrollArrearsLedger;
