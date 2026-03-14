import mongoose from "mongoose";

const allowancePolicyAmountHistorySchema = new mongoose.Schema(
  {
    allowancePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowancePolicy",
      required: true,
    },
    fromComponents: [
      {
        allowanceComponent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AllowanceComponent",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    toComponents: [
      {
        allowanceComponent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AllowanceComponent",
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
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

allowancePolicyAmountHistorySchema.index({ allowancePolicy: 1, effectiveDate: 1 });
allowancePolicyAmountHistorySchema.index({ allowancePolicy: 1, changedAt: -1 });

const AllowancePolicyAmountHistory = mongoose.model(
  "AllowancePolicyAmountHistory",
  allowancePolicyAmountHistorySchema
);

export default AllowancePolicyAmountHistory;
