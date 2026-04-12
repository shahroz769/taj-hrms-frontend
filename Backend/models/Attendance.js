import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "Off", "Leave"],
      required: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    lateDurationMinutes: {
      type: Number,
      default: 0,
    },
    workHours: {
      type: Number,
      default: null,
    },
    source: {
      type: String,
      enum: ["manual", "device", "leave_auto"],
      default: "manual",
    },
    lockReason: {
      type: String,
      enum: ["approved_leave"],
      default: null,
    },
    linkedLeaveApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeaveApplication",
      default: null,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Monthly stats cache — updated whenever an attendance record is saved/deleted
    // Used by payroll module to avoid expensive re-aggregation
    // This field is stored on a separate MonthlyAttendanceSummary model (see below)
  },
  { timestamps: true },
);

// Compound unique index: one record per employee per date
// Also serves all employee-equality + date-range queries (ascending and descending)
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Date+status index — used by date-range/status based queries (e.g. payroll reporting)
attendanceSchema.index({ date: 1, status: 1 });

// removeApprovedLeaveAttendance: find({ employee, linkedLeaveApplication, lockReason })
// called on every leave rejection/revert — sparse because most records don't have this field
attendanceSchema.index(
  { employee: 1, linkedLeaveApplication: 1 },
  { sparse: true },
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
