import mongoose from "mongoose";

const deductionSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    date: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Deducted"],
      default: "Pending",
    },
    originalDueYear: {
      type: Number,
      default: null,
    },
    originalDueMonth: {
      type: Number,
      default: null,
    },
    currentDueYear: {
      type: Number,
      default: null,
    },
    currentDueMonth: {
      type: Number,
      default: null,
    },
    deductedAt: {
      type: Date,
      default: null,
    },
    deductedByPayroll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payroll",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

deductionSchema.index({ employee: 1, date: 1 });
deductionSchema.index({ date: 1 });
deductionSchema.index({ employee: 1, status: 1, currentDueYear: 1, currentDueMonth: 1 });
// Payroll deduction planning also sorts by due year/month, then date/createdAt.
deductionSchema.index({
  employee: 1,
  status: 1,
  currentDueYear: 1,
  currentDueMonth: 1,
  date: 1,
  createdAt: 1,
});

const Deduction = mongoose.model("Deduction", deductionSchema);

export default Deduction;
