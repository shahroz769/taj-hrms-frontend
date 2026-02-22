import mongoose from "mongoose";

const dateRangeSchema = new mongoose.Schema(
  {
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const leaveApplicationSchema = new mongoose.Schema(
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
    dateRanges: {
      type: [dateRangeSchema],
      required: true,
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one date range is required",
      },
    },
    dates: {
      type: [Date],
      required: true,
    },
    daysCount: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
leaveApplicationSchema.index({ employee: 1, status: 1 });
leaveApplicationSchema.index({ createdAt: -1 });

const LeaveApplication = mongoose.model(
  "LeaveApplication",
  leaveApplicationSchema
);

export default LeaveApplication;
