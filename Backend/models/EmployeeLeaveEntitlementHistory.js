import mongoose from "mongoose";

const leaveEntitlementSnapshotSchema = new mongoose.Schema(
  {
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    annualDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    method: {
      type: String,
      enum: ["Fixed", "Prorata"],
      default: "Fixed",
    },
    autoManaged: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const employeeLeaveEntitlementHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    fromEntitlements: {
      type: [leaveEntitlementSnapshotSchema],
      default: [],
    },
    toEntitlements: {
      type: [leaveEntitlementSnapshotSchema],
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

employeeLeaveEntitlementHistorySchema.index({ employee: 1, effectiveDate: 1 });
employeeLeaveEntitlementHistorySchema.index({ employee: 1, changedAt: -1 });

const EmployeeLeaveEntitlementHistory = mongoose.model(
  "EmployeeLeaveEntitlementHistory",
  employeeLeaveEntitlementHistorySchema,
);

export default EmployeeLeaveEntitlementHistory;
