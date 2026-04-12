import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
    },
    allowancePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AllowancePolicy",
      default: null,
    },
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
    guarantor: [
      {
        name: String,
        contactNumber: String,
        cnic: String,
        address: String,
      },
    ],

    // --- Legal ---
    legal: {
      involvedInIllegalActivity: Boolean,
      illegalActivityDetails: String,
      convictedBefore: Boolean,
      convictedBeforeDetails: String,
      restrictedPlaces: Boolean,
      restrictedPlacesDetails: String,
    },
  },
  { timestamps: true },
);

// status is the most common equality filter across the app (Active/Inactive/etc.)
// Combined with createdAt covers the default sort in getAllEmployees and payroll batch queries
employeeSchema.index({ status: 1, createdAt: -1 });
// generateEmployeeId() calls findOne().sort({ createdAt: -1 }) with no filter;
// a standalone index allows this to resolve in a single entry lookup instead of a collection scan
employeeSchema.index({ createdAt: -1 });

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
