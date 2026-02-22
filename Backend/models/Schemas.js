import { Schema } from "mongoose";

// 5. ShiftAssignment (History)
const shiftAssignmentSchema = new Schema(
  {
    employee: [
      { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    ],
    shift: { type: Schema.Types.ObjectId, required: true, ref: "Shift" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["Approved", "Pending", "Rejected"],
    },
  },
  { timestamps: true }
);

// 6. Attendance
const attendanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, required: true, ref: "Employee" },
    date: { type: Date, required: true },
    shiftSnapshot: { type: Schema.Types.ObjectId, ref: "Shift" },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Late",
        "Half Day",
        "Leave",
        "Holiday",
        "Weekend",
      ],
    },

    lateDurationMinutes: { type: Number },
    workHours: { type: Number },
    isOvertime: { type: Boolean },
  },
  { timestamps: true }
);

// 8. LeaveRequest
const leaveRequestSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    leaveType: { type: String, enum: ["Casual", "Sick", "Unpaid"] },
    startDate: { type: Date },
    endDate: { type: Date },
    daysCount: { type: Number },
    reason: { type: String },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true }
);

// 9. Contract
const contractSchema = new Schema(
  {
    contractId: { type: String },
    name: { type: String },
    type: { type: String, enum: ["Employee", "External"] },
    workerCount: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    wageType: { type: String, enum: ["Hourly", "Daily", "Monthly"] },
    rate: { type: Number },
    status: { type: String, enum: ["Active", "Inactive"] },
  },
  { timestamps: true }
);

// 10. WorkReport (Tasks)
const workReportSchema = new Schema(
  {
    description: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: "Employee" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "Employee" }, // Supervisor
    assignedDate: { type: Date },
    targetDate: { type: Date },
    extensionDate: { type: Date },
    actualClosingDate: { type: Date },
    status: { type: String, enum: ["Open", "Pending", "Hold", "Done"] },
    satisfactionLevel: { type: String, enum: ["Satisfied", "Not Satisfied"] },
    remarks: { type: String },
  },
  { timestamps: true }
);

// 11. Warning
const warningSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    type: { type: String, enum: ["Verbal", "Written", "Final", "Dismissal"] },
    description: { type: String },
    status: { type: String, enum: ["Active", "Inactive"] },
  },
  { timestamps: true }
);

// 12. Payroll
const payrollSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "Employee" },
    month: { type: Number },
    year: { type: Number },

    // Statistics from Attendance Module
    stats: {
      totalDays: Number,
      workingDays: Number,
      attendedDays: Number,
      absences: Number,
      leaves: Number,
      lates: Number,
    },
    basicSalary: Number,
    // Snapshotted
    earnings: {
      houseRent: Number,
      utility: Number,
      medical: Number,
      communication: Number,
      overtimeAmount: Number,
      totalEarnings: Number,
    },

    deductions: {
      advanceRepayment: Number,
      loanRepayment: Number,
      absentDeduction: Number,
      totalDeductions: Number,
    },

    netPay: Number,
    status: { type: String, enum: ["Generated", "Paid"], default: "Generated" },
  },
  { timestamps: true }
);

export {
  shiftAssignmentSchema,
  attendanceSchema,
  leaveRequestSchema,
  contractSchema,
  workReportSchema,
  warningSchema,
  payrollSchema,
};
