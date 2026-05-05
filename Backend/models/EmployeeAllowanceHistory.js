import mongoose from "mongoose";

const allowanceSnapshotSchema = new mongoose.Schema(
  {
    allowanceComponent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowanceComponent",
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const employeeAllowanceHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    fromAllowances: {
      type: [allowanceSnapshotSchema],
      default: [],
    },
    toAllowances: {
      type: [allowanceSnapshotSchema],
      default: [],
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

employeeAllowanceHistorySchema.index({ employee: 1, effectiveDate: 1 });
employeeAllowanceHistorySchema.index({ employee: 1, changedAt: -1 });

const EmployeeAllowanceHistory = mongoose.model(
  "EmployeeAllowanceHistory",
  employeeAllowanceHistorySchema,
);

export default EmployeeAllowanceHistory;
