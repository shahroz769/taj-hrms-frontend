import { z } from "zod";

// Emergency Contact Schema (Required)
const emergencyContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  number: z.string().min(1, "Contact number is required"),
  relation: z.string().min(1, "Relation is required"),
});

// Education Schema (Optional - all fields optional)
const educationSchema = z.object({
  qualification: z.string().optional(),
  institute: z.string().optional(),
  grades: z.string().optional(),
  status: z.string().optional(),
});

// Previous Experience Schema (Optional - all fields optional)
const previousExperienceSchema = z.object({
  company: z.string().optional(),
  position: z.string().optional(),
  from: z.union([z.string(), z.date()]).optional().nullable(),
  to: z.union([z.string(), z.date()]).optional().nullable(),
  lastSalary: z.union([z.string(), z.number()]).optional(),
});

// Guarantor Schema (Required)
const guarantorSchema = z.object({
  name: z.string().min(1, "Guarantor name is required"),
  contactNumber: z.string().min(1, "Guarantor contact number is required"),
  cnic: z.string().min(1, "Guarantor CNIC is required"),
  address: z.string().min(1, "Guarantor address is required"),
});

// Medical Schema (Required fields)
const medicalSchema = z.object({
  bloodGroup: z.string().min(1, "Blood group is required"),
  hasHealthIssues: z.boolean(),
  healthIssueDetails: z.string().optional(),
  disability: z.boolean(),
  disabilityDetails: z.string().optional(),
});

// Legal Schema (Required fields)
const legalSchema = z.object({
  involvedInIllegalActivity: z.boolean(),
  illegalActivityDetails: z.string().optional(),
  convictedBefore: z.boolean(),
  convictedBeforeDetails: z.string().optional(),
  restrictedPlaces: z.boolean(),
  restrictedPlacesDetails: z.string().optional(),
});

// Main Employee Schema
export const employeeSchema = z.object({
  // Personal Information - Required
  fullName: z.string().min(1, "Full name is required"),
  gender: z.enum(["Male", "Female"], { 
    required_error: "Gender is required",
    invalid_type_error: "Gender is required"
  }),
  dob: z.union([z.string(), z.date()], {
    required_error: "Date of birth is required",
  }),
  fatherName: z.string().min(1, "Father name is required"),
  husbandName: z.string().optional(), // Optional since not applicable to all
  cnic: z.string().min(1, "CNIC is required"),
  contactNumber: z.string().min(1, "Contact number is required"),
  province: z.string().min(1, "Province is required"),
  city: z.string().min(1, "City is required"),
  maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"], {
    required_error: "Marital status is required",
    invalid_type_error: "Marital status is required"
  }),
  currentStreetAddress: z.string().min(1, "Current street address is required"),
  permanentStreetAddress: z
    .string()
    .min(1, "Permanent street address is required"),

  // Employment Information - Required
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  employmentType: z.enum(["Permanent", "Contract", "Part Time"], {
    required_error: "Employment type is required",
    invalid_type_error: "Employment type is required"
  }),
  salaryPolicy: z.string().min(1, "Salary policy is required"),
  joiningDate: z.union([z.string(), z.date()], {
    required_error: "Joining date is required",
  }),

  // Arrays
  emergencyContact: z
    .array(emergencyContactSchema)
    .min(1, "At least one emergency contact is required"),
  education: z.array(educationSchema).optional(), // Optional
  previousExperience: z.array(previousExperienceSchema).optional(), // Optional
  guarantor: z
    .array(guarantorSchema)
    .min(1, "At least one guarantor is required"),

  // Objects
  medical: medicalSchema,
  legal: legalSchema,
});

export default employeeSchema;
