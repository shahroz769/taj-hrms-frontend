import mongoose from "mongoose";

const shiftSegmentSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false },
);

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // ---------------------------------------------------------------------
    // Split-shift support:
    //  - `segments` always holds the canonical timing definition
    //    (1 segment for normal shifts, 2 for split shifts).
    //  - `isSplit` mirrors `segments.length === 2` and is set in the controller.
    //  - Top-level `startTime`/`endTime` always mirror the FIRST segment for
    //    backward compatibility with legacy reports/payroll code.
    //
    // Validation (controller): split shifts must have exactly 2 non-overlapping
    // segments separated by at least 1 hour.
    // ---------------------------------------------------------------------
    isSplit: {
      type: Boolean,
      default: false,
    },
    segments: {
      type: [shiftSegmentSchema],
      default: undefined,
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

// Paginated list sorts by createdAt desc
shiftSchema.index({ createdAt: -1 });

// getShiftsList (dropdown): find({ status: "Approved" }).sort({ name: 1 })
shiftSchema.index({ status: 1, name: 1 });

const Shift = mongoose.model("Shift", shiftSchema);

export default Shift;
