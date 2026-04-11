import mongoose from "mongoose";

const testAttendanceSchema = new mongoose.Schema(
  {
    userID: { type: String },
    checkTime: { type: Date },
    attState: {
      type: String,
      enum: ["check-in", "check-out", "break-out", "break-in", "overtime-in", "overtime-out"],
    },
  },
  { timestamps: true }
);

const TestAttendance = mongoose.model("TestAttendance", testAttendanceSchema);

export default TestAttendance;
