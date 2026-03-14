import mongoose from "mongoose";

const timelineEntrySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "Task Assigned",
        "Task Started",
        "Remarks Added",
        "Task Completed",
        "Task Closed",
      ],
    },
    performedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
    },
    timestamp: {
      type: Date,
      required: true,
    },
    details: {
      type: String,
      default: "",
    },
  },
  { _id: true },
);

const remarkSchema = new mongoose.Schema(
  {
    addedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
    },
    date: {
      type: Date,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
  },
  { _id: true },
);

const workProgressReportSchema = new mongoose.Schema(
  {
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },
    ],
    assignmentDate: {
      type: Date,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    daysForCompletion: {
      type: Number,
      required: true,
      min: 1,
    },
    taskDescription: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "In Progress",
        "Completed (Early)",
        "Completed (On Time)",
        "Completed (Late)",
        "Closed (Early)",
        "Closed (On Time)",
        "Closed (Late)",
        "Closed", // legacy – kept for backward compatibility
      ],
      default: "Pending",
    },
    startDate: {
      type: Date,
      default: null,
    },
    completionDate: {
      type: Date,
      default: null,
    },
    assignedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
    },
    startedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
    },
    completedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
    },
    closedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
    },
    closingRemarks: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },
    remarks: [remarkSchema],
    timeline: [timelineEntrySchema],
  },
  { timestamps: true },
);

const WorkProgressReport = mongoose.model(
  "WorkProgressReport",
  workProgressReportSchema,
);

export default WorkProgressReport;
