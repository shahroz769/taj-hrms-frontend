import mongoose from "mongoose";

const warningTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    status: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
      default: "Pending",
    },
    createdBy: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const WarningType = mongoose.model("WarningType", warningTypeSchema);

export default WarningType;
