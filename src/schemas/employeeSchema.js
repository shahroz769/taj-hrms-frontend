import { z } from "zod";

const CNIC_REGEX = /^\d{13}$/;
const PAKISTAN_MOBILE_REGEX = /^03\d{9}$/;
const PROVINCES = [
  "Sindh",
  "Punjab",
  "KPK",
  "Balochistan",
  "AJK",
  "Gilgit",
];

// Emergency Contact Schema (Required)
const emergencyContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  number: z
    .string()
    .min(1, "Contact number is required")
    .regex(
      PAKISTAN_MOBILE_REGEX,
      "Contact number must start with 03 and be 11 digits",
    ),
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
  contactNumber: z
    .string()
    .min(1, "Guarantor contact number is required")
    .regex(
      PAKISTAN_MOBILE_REGEX,
      "Guarantor contact number must start with 03 and be 11 digits",
    ),
  cnic: z
    .string()
    .min(1, "Guarantor CNIC is required")
    .regex(CNIC_REGEX, "Guarantor CNIC must be exactly 13 digits"),
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
export const employeeSchema = z
  .object({
    // Personal Information - Required
    fullName: z.string().min(1, "Full name is required"),
    gender: z.enum(["Male", "Female"], {
      required_error: "Gender is required",
      invalid_type_error: "Gender is required",
    }),
    dob: z.union([z.string(), z.date()], {
      required_error: "Date of birth is required",
    }),
    fatherName: z.string().min(1, "Father name is required"),
    husbandName: z.string().optional(),
    cnic: z
      .string()
      .min(1, "CNIC is required")
      .regex(CNIC_REGEX, "CNIC must be exactly 13 digits"),
    contactNumber: z
      .string()
      .min(1, "Contact number is required")
      .regex(
        PAKISTAN_MOBILE_REGEX,
        "Contact number must start with 03 and be 11 digits",
      ),
    province: z.enum(PROVINCES, {
      required_error: "Province is required",
      invalid_type_error: "Province is required",
    }),
    city: z.string().min(1, "City is required"),
    maritalStatus: z.enum(["Single", "Married", "Divorced", "Widowed"], {
      required_error: "Marital status is required",
      invalid_type_error: "Marital status is required",
    }),
    currentStreetAddress: z
      .string()
      .min(1, "Current street address is required"),
    permanentStreetAddress: z
      .string()
      .min(1, "Permanent street address is required"),

    // Employment Information - Required
    department: z.string().min(1, "Department is required"),
    position: z.string().min(1, "Position is required"),
    employmentType: z.enum(["Permanent", "Contract", "Part Time"], {
      required_error: "Employment type is required",
      invalid_type_error: "Employment type is required",
    }),
    basicSalary: z.union([z.string(), z.number()]).refine(
      (val) => !isNaN(Number(val)) && Number(val) >= 0,
      { message: "Basic salary must be a non-negative number" },
    ),
    allowancePolicy: z.string().min(1, "Allowance policy is required"),
    compensationEffectiveDate: z
      .union([z.string(), z.date()])
      .optional()
      .nullable(),
    compensationChangeReason: z.string().optional(),
    joiningDate: z.union([z.string(), z.date()], {
      required_error: "Joining date is required",
    }),

    // Arrays
    emergencyContact: z
      .array(emergencyContactSchema)
      .min(1, "At least one emergency contact is required"),
    education: z.array(educationSchema).optional(),
    previousExperience: z.array(previousExperienceSchema).optional(),
    guarantor: z
      .array(guarantorSchema)
      .min(1, "At least one guarantor is required"),

    // Objects
    medical: medicalSchema,
    legal: legalSchema,
  })
  .superRefine((data, ctx) => {
    const shouldRequireHusbandName =
      data.gender === "Female" && data.maritalStatus === "Married";

    if (shouldRequireHusbandName && !data.husbandName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["husbandName"],
        message: "Husband name is required for married female employees",
      });
    }
  });

export default employeeSchema;
