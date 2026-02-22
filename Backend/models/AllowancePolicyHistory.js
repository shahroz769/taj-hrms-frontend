import mongoose from "mongoose";

const allowancePolicyHistorySchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
    },
    fromAllowancePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowancePolicy",
      default: null,
    },
    toAllowancePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowancePolicy",
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

// Index for efficient queries by position
allowancePolicyHistorySchema.index({ position: 1, changedAt: -1 });

const AllowancePolicyHistory = mongoose.model(
  "AllowancePolicyHistory",
  allowancePolicyHistorySchema
);

export default AllowancePolicyHistory;
