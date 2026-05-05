import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
    },
    employeeOf: {
      type: String,
      enum: ["Taj Agri", "YD"],
      required: true,
      default: "Taj Agri",
    },
    allowances: [
      {
        allowanceComponent: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AllowanceComponent",
          required: true,
        },
        enabled: {
          type: Boolean,
          default: false,
        },
        amount: {
          type: Number,
          default: 0,
          min: 0,
        },
        effectiveDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    leaveEntitlements: [
      {
        leaveType: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LeaveType",
          required: true,
        },
        enabled: {
          type: Boolean,
          default: true,
        },
        annualDays: {
          type: Number,
          default: 0,
          min: 0,
        },
        method: {
          type: String,
          enum: ["Fixed", "Prorata"],
          default: "Fixed",
        },
        effectiveDate: {
          type: Date,
          default: Date.now,
        },
        autoManaged: {
          type: Boolean,
          default: false,
        },
      },
    ],
    basicSalary: {
      type: Number,
      default: 0,
      min: [0, "Basic salary cannot be negative"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Resigned", "Terminated"],
      default: "Active",
      required: true,
    },
    employmentType: {
      type: String,
      enum: ["Permanent", "Contract", "Part Time"],
      default: "Permanent",
    },

    // --- Personal Information ---
    fullName: { type: String, required: true },
    employeeID: { type: String, unique: true, sparse: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    fatherName: String,
    husbandName: String,
    joiningDate: Date,
    resignationDate: {
      type: Date,
      default: null,
    },
    employeePicture: String,
    cnic: { type: String, unique: true },
    cnicImages: { front: String, back: String },
    dob: Date,
    contactNumber: String,
    province: String,
    city: String,
    maritalStatus: {
      type: String,
      enum: ["Single", "Married", "Divorced", "Widowed"],
      default: "Single",
    },
    currentStreetAddress: String,
    permanentStreetAddress: String,
    emergencyContact: [
      {
        name: String,
        number: String,
        relation: String,
      },
    ],

    // --- Medical Information ---
    medical: {
      bloodGroup: String,
      hasHealthIssues: Boolean,
      healthIssueDetails: String,
      disability: Boolean,
      disabilityDetails: String,
    },

    // --- Education ---
    education: [
      {
        qualification: String,
        institute: String,
        grades: String,
        status: String,
      },
    ],

    // --- Professional Experience ---
    previousExperience: [
      {
        company: String,
        position: String,
        from: Date,
        to: Date,
        lastSalary: Number,
      },
    ],

    // --- Reference / Guarantor ---
    references: [
      {
        name: String,
        contactNumber: String,
        relation: String,
        address: String,
      },
    ],
    guarantor: [
      {
        name: String,
        contactNumber: String,
        relation: String,
        cnic: String,
        address: String,
        documentUrl: String,
      },
    ],

    // --- Legal ---
    legal: {
      convictedCriminalCorruptionCase: Boolean,
      rusticatedDismissedTerminated: Boolean,
      pendingLitigationCourtCase: Boolean,
      availableAnywhereInPakistan: Boolean,
    },
  },
  { timestamps: true },
);

// status is the most common equality filter across the app (Active/Inactive/etc.)
// Combined with createdAt covers the default sort in getAllEmployees and payroll batch queries
employeeSchema.index({ status: 1, createdAt: -1 });
// Payroll eligibility checks filter active employees by joiningDate before month end.
employeeSchema.index({ status: 1, joiningDate: 1 });
// generateEmployeeId() calls findOne().sort({ createdAt: -1 }) with no filter;
// a standalone index allows this to resolve in a single entry lookup instead of a collection scan
employeeSchema.index({ createdAt: -1 });

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
