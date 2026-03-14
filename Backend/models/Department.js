import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
    },
    positionCount: {
      type: String,
      required: [true, "Position count is required"],
    },
    employeeCount: {
      type: Number,
      default: 0,
      min: [0, "Employee count cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to get positions in this department
departmentSchema.virtual("positions", {
  ref: "Position",
  localField: "_id",
  foreignField: "department",
});

const Department = mongoose.model("Department", departmentSchema);

export default Department;
