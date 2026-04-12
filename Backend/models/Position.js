import mongoose from "mongoose";

const positionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    // reportsTo: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Employee",
    //   default: null,
    // },
    reportsTo: {
      type: String,
    },
    leavePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeavePolicy",
      required: true,
    },
    employeeLimit: {
      type: String,
      required: [true, "Employee Limit is required"],
    },
    hiredEmployees: {
      type: Number,
      default: 0,
      min: [0, "Hired count cannot be negative"],
    },
  },
  { timestamps: true }
);

// Compound index to ensure position name is unique within a department
positionSchema.index({ name: 1, department: 1 }, { unique: true });

// Main list filters by department (equality) then sorts by createdAt desc;
// the unique index above leads with name so it can't serve department-only filters efficiently
positionSchema.index({ department: 1, createdAt: -1 });

// Virtual to get current hired count from Employee collection
// positionSchema.virtual("hiredCount", {
//   ref: "Employee",
//   localField: "_id",
//   foreignField: "position",
//   count: true,
// });

const Position = mongoose.model("Position", positionSchema);

export default Position;
