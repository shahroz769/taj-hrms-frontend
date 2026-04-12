import mongoose from "mongoose";

const basicSalaryHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    fromBasicSalary: {
      type: Number,
      default: 0,
      min: 0,
    },
    toBasicSalary: {
      type: Number,
      required: true,
      min: 0,
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
  { timestamps: true }
);

basicSalaryHistorySchema.index({ employee: 1, effectiveDate: 1 });
basicSalaryHistorySchema.index({ employee: 1, changedAt: -1 });
// getEmployeeCompensationHistory sorts by { effectiveDate: -1, changedAt: -1 };
// the ascending effectiveDate index above cannot serve a descending sort
basicSalaryHistorySchema.index({ employee: 1, effectiveDate: -1, changedAt: -1 });

const BasicSalaryHistory = mongoose.model(
  "BasicSalaryHistory",
  basicSalaryHistorySchema
);

export default BasicSalaryHistory;
