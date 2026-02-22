import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Position",
      required: true,
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
    employeeID: { type: String, unique: true },
    gender: { type: String, enum: ["Male", "Female"], required: true },
    fatherName: String,
    husbandName: String,
    joiningDate: Date,
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

const Employee = mongoose.model("Employee", employeeSchema);

export default Employee;
