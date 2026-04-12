import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
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

// Paginated list always sorts by createdAt desc
departmentSchema.index({ createdAt: -1 });

// Unique constraint + collation for case-insensitive uniqueness enforcement and
// for getAllDepartmentsList which sorts by name with collation { locale: "en", strength: 2 }.
// Defined here (not via field-level unique:true) so both options live in one index.
departmentSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const Department = mongoose.model("Department", departmentSchema);

export default Department;
