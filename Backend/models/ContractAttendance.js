import mongoose from "mongoose";

const contractAttendanceSchema = new mongoose.Schema(
  {
    contractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Contract",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    laborersPresent: {
      type: Number,
      required: true,
      min: 0,
    },
    dayCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate attendance for same contract and date
contractAttendanceSchema.index({ contractId: 1, date: 1 }, { unique: true });

export default mongoose.model("ContractAttendance", contractAttendanceSchema);
