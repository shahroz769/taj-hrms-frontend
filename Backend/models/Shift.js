import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    workingDays: [
      {
        type: String,
        enum: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        required: true,
      },
    ],
    notes: {
      type: String,
      default: "",
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
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Employee",
    //   required: true,
    // },
  },
  { timestamps: true }
);

const Shift = mongoose.model("Shift", shiftSchema);

export default Shift;
