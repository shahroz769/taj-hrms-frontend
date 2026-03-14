import mongoose from "mongoose";

// Cached monthly attendance summary per employee
// Updated automatically after every attendance record change (bulk mark, edit, delete)
// Used by payroll module to avoid expensive re-aggregation every time
const monthlyAttendanceSummarySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    month: {
      type: Number, // 0-indexed (0 = January, 11 = December)
      required: true,
    },
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    halfDay: { type: Number, default: 0 },
    off: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    totalWorkingDays: { type: Number, default: 0 }, // present + late + halfDay
  },
  { timestamps: true },
);

// Compound unique index: one summary per employee per year-month
monthlyAttendanceSummarySchema.index(
  { employee: 1, year: 1, month: 1 },
  { unique: true },
);

const MonthlyAttendanceSummary = mongoose.model(
  "MonthlyAttendanceSummary",
  monthlyAttendanceSummarySchema,
);

export default MonthlyAttendanceSummary;
