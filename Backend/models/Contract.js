import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    contractName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    numberOfLabors: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Number of labors must be an integer",
      },
    },
    contractAmount: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Contract amount must be an integer",
      },
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Suspended"],
      default: "Active",
    },
    perLaborCostPerDay: {
      type: Number,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
    },
    totalDaysWorked: {
      type: Number,
      default: 0,
    },
    suspendedDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Contract", contractSchema);
