import mongoose from "mongoose";

const allowanceComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
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

const AllowanceComponent = mongoose.model("AllowanceComponent", allowanceComponentSchema);

export default AllowanceComponent;
