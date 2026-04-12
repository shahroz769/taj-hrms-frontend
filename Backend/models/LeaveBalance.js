import mongoose from "mongoose";

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0,
    },
    usedDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingDays: {
      type: Number,
      required: true,
      min: 0,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique leave balance per employee, leave type, and year
leaveBalanceSchema.index(
  { employee: 1, leaveType: 1, year: 1 },
  { unique: true }
);
// getEmployeeById fetches leave balances sorted by { year: -1 };
// the unique index above has year after leaveType so MongoDB can't use it for the sort
leaveBalanceSchema.index({ employee: 1, year: -1 });

const LeaveBalance = mongoose.model("LeaveBalance", leaveBalanceSchema);

export default LeaveBalance;
