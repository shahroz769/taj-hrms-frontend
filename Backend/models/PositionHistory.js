import mongoose from "mongoose";

const positionHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    fromPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      default: null,
    },
    toPosition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
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
    effectiveDate: {
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

// Index for efficient queries by employee
positionHistorySchema.index({ employee: 1, changedAt: -1 });

const PositionHistory = mongoose.model(
  "PositionHistory",
  positionHistorySchema
);

export default PositionHistory;
