import mongoose from "mongoose";

const leavePolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    entitlements: [
      {
        leaveType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LeaveType",
          required: true,
        },
        days: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
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

const LeavePolicy = mongoose.model("LeavePolicy", leavePolicySchema);

export default LeavePolicy;
