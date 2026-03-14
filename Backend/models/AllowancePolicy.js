import mongoose from "mongoose";

const allowancePolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    components: [
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
  { timestamps: true }
);

const AllowancePolicy = mongoose.model("AllowancePolicy", allowancePolicySchema);

export default AllowancePolicy;
