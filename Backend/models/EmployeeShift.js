import mongoose from "mongoose";

const employeeShiftSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null, // null means currently active/infinite
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Index for efficient queries by employee and date
employeeShiftSchema.index({ employee: 1, effectiveDate: -1 });
employeeShiftSchema.index({ shift: 1, endDate: 1 });
// Active-shift lookup: find({ employee: id/ids, endDate: null }) — called for every
// getAllEmployees response to attach the current shift to each employee
employeeShiftSchema.index({ employee: 1, endDate: 1 });
// payrollService: getScheduledDatesForPayrollDivisor sorts by { effectiveDate: 1 } (ascending)
// per employee; an ascending index avoids reverse-traversal of the descending one above
employeeShiftSchema.index({ employee: 1, effectiveDate: 1 });

const EmployeeShift = mongoose.model("EmployeeShift", employeeShiftSchema);

export default EmployeeShift;
