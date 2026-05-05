import mongoose from "mongoose";

// Singleton document holding org-wide attendance rules.
// Always referenced via getAttendanceRules() which upserts a default doc.
const attendanceRuleSchema = new mongoose.Schema(
  {
    // Minutes after shift start that are still counted as on-time (Present).
    // Check-in within this window is NOT marked Late.
    graceMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 240,
      default: 15,
    },

    // How many minutes before shift start an employee may check in
    // and still have it counted toward that shift.
    earlyCheckInMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 720,
      default: 30,
    },

    // Check-in at or after (shiftStart + this many minutes) is treated as Absent
    // even if the employee did check in.
    absentAfterLateMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 720,
      default: 60,
    },

    // Check-out earlier than (shiftEnd - this many minutes) downgrades the
    // attendance to Half Day.
    halfDayEarlyCheckOutMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 720,
      default: 60,
    },

    // Minutes after shift end beyond which a check-out is flagged as
    // Late Check-out (used for reporting / overtime visibility).
    lateCheckOutMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 720,
      default: 30,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  { timestamps: true }
);

const AttendanceRule = mongoose.model("AttendanceRule", attendanceRuleSchema);

export default AttendanceRule;
