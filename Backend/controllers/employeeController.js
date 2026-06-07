import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import Department from "../models/Department.js";
import LeaveBalance from "../models/LeaveBalance.js";
import LeaveType from "../models/LeaveType.js";
import AllowanceComponent from "../models/AllowanceComponent.js";
import PositionHistory from "../models/PositionHistory.js";
import EmployeeShift from "../models/EmployeeShift.js";
import EmployeeAllowanceHistory from "../models/EmployeeAllowanceHistory.js";
import EmployeeLeaveEntitlementHistory from "../models/EmployeeLeaveEntitlementHistory.js";
import BasicSalaryHistory from "../models/BasicSalaryHistory.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payroll from "../models/Payroll.js";
import { uploadToCloudinary } from "../config/cloudinaryConfig.js";
import mongoose from "mongoose";

const VALID_PROVINCES = [
  "Sindh",
  "Punjab",
  "KPK",
  "Balochistan",
  "AJK",
  "Gilgit",
];
const CNIC_REGEX = /^\d{13}$/;
const PAKISTAN_MOBILE_REGEX = /^03\d{9}$/;

const EARNED_LEAVE_NAME = "Earned Leave";
const EARNED_LEAVE_YEAR = 0;

// Helper function to generate employee ID
const generateEmployeeId = async () => {
  const [lastEmployee] = await Employee.aggregate([
    {
      $match: {
        employeeID: { $regex: /^(?:[A-Z]{2})?\d{5}$/ },
      },
    },
    {
      $addFields: {
        employeeSequence: {
          $toInt: {
            $substr: [
              "$employeeID",
              { $subtract: [{ $strLenCP: "$employeeID" }, 5] },
              5,
            ],
          },
        },
      },
    },
    { $sort: { employeeSequence: -1 } },
    { $limit: 1 },
    { $project: { employeeSequence: 1 } },
  ]);

  if (!lastEmployee?.employeeSequence) {
    return "00001";
  }

  const lastNumber = lastEmployee.employeeSequence;
  const newNumber = (lastNumber + 1).toString().padStart(5, "0");
  return newNumber;
};

export const getNextEmployeeId = async (req, res, next) => {
  try {
    res.json({ employeeID: await generateEmployeeId() });
  } catch (err) {
    next(err);
  }
};

const ensureEarnedLeaveType = async () => {
  return LeaveType.findOneAndUpdate(
    { name: { $regex: new RegExp(`^${EARNED_LEAVE_NAME}$`, "i") } },
    {
      $setOnInsert: {
        name: EARNED_LEAVE_NAME,
        isPaid: true,
        status: "Approved",
        createdBy: "system",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
};

const monthsEligibleForYear = (effectiveDate, year) => {
  const start = new Date(effectiveDate || Date.UTC(year, 0, 1));
  const startYear = start.getFullYear();
  if (startYear > year) return 0;
  if (startYear < year) return 12;

  const firstMonth = start.getDate() <= 15 ? start.getMonth() : start.getMonth() + 1;
  return Math.max(0, 12 - firstMonth);
};

const calculateEntitlementDays = (entitlement, year) => {
  const annualDays = Number(entitlement.annualDays || 0);
  if (!entitlement.enabled) return 0;
  if (entitlement.autoManaged) return 0;
  if (entitlement.method !== "Prorata") return annualDays;
  return Math.ceil((annualDays / 12) * monthsEligibleForYear(entitlement.effectiveDate, year));
};

const normalizeLeaveEntitlements = async (rawEntitlements, effectiveDate) => {
  const parsed = parseIfString(rawEntitlements) || [];
  const earnedLeave = await ensureEarnedLeaveType();
  const entitlements = [];
  const seen = new Set();

  for (const item of Array.isArray(parsed) ? parsed : []) {
    if (!item?.leaveType || !mongoose.Types.ObjectId.isValid(item.leaveType)) continue;
    if (item.leaveType.toString() === earnedLeave._id.toString()) continue;

    const leaveType = await LeaveType.findById(item.leaveType);
    if (!leaveType || leaveType.status !== "Approved") continue;
    const key = leaveType._id.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const enabled = Boolean(item.enabled);
    entitlements.push({
      leaveType: leaveType._id,
      enabled,
      annualDays: enabled ? Math.max(0, Number(item.annualDays || 0)) : 0,
      method: item.method === "Prorata" ? "Prorata" : "Fixed",
      effectiveDate: item.effectiveDate || effectiveDate || new Date(),
      autoManaged: false,
    });
  }

  entitlements.push({
    leaveType: earnedLeave._id,
    enabled: true,
    annualDays: 0,
    method: "Fixed",
    effectiveDate: effectiveDate || new Date(),
    autoManaged: true,
  });

  return entitlements;
};

const normalizeAllowances = async (rawAllowances, effectiveDate) => {
  const parsed = parseIfString(rawAllowances) || [];
  const allowances = [];
  const seen = new Set();

  for (const item of Array.isArray(parsed) ? parsed : []) {
    if (!item?.allowanceComponent || !mongoose.Types.ObjectId.isValid(item.allowanceComponent)) continue;

    const component = await AllowanceComponent.findById(item.allowanceComponent);
    if (!component || component.status !== "Approved") continue;
    const key = component._id.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const enabled = Boolean(item.enabled);
    allowances.push({
      allowanceComponent: component._id,
      enabled,
      amount: enabled ? Math.max(0, Number(item.amount || 0)) : 0,
      effectiveDate: item.effectiveDate || effectiveDate || new Date(),
    });
  }

  return allowances;
};

const getPayrollAllowanceSignature = (allowances = []) =>
  JSON.stringify(
    (allowances || [])
      .filter((item) => Boolean(item.enabled))
      .map((item) => ({
        allowanceComponent: item.allowanceComponent?.toString(),
        amount: Number(item.amount || 0),
      }))
      .sort((a, b) => a.allowanceComponent.localeCompare(b.allowanceComponent)),
  );

const isFutureEffectiveDate = (date) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
};

const syncLeaveBalancesFromEntitlements = async (employeeId, entitlements, year) => {
  const leaveBalances = [];

  for (const entitlement of entitlements || []) {
    const targetYear = entitlement.autoManaged ? EARNED_LEAVE_YEAR : year;
    const totalDays = entitlement.autoManaged
      ? 0
      : calculateEntitlementDays(entitlement, year);
    if (!entitlement.enabled && !entitlement.autoManaged) continue;

    const existingBalance = await LeaveBalance.findOne({
      employee: employeeId,
      leaveType: entitlement.leaveType,
      year: targetYear,
    });

    if (existingBalance) {
      if (!entitlement.autoManaged) {
        existingBalance.totalDays = totalDays;
        existingBalance.remainingDays = Math.max(
          0,
          existingBalance.totalDays - existingBalance.usedDays,
        );
      }
      await existingBalance.save();
      leaveBalances.push(existingBalance);
      continue;
    }

    const newBalance = await LeaveBalance.create({
      employee: employeeId,
      leaveType: entitlement.leaveType,
      totalDays,
      usedDays: 0,
      remainingDays: totalDays,
      year: targetYear,
    });
    leaveBalances.push(newBalance);
  }

  return leaveBalances;
};

const parseIfString = (value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

const normalizeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateCnic = (value, fieldName = "CNIC", required = true) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return;
  }

  if (!CNIC_REGEX.test(normalizedValue)) {
    throw new Error(`${fieldName} must be exactly 13 digits`);
  }
};

const validateMobileNumber = (
  value,
  fieldName = "Contact number",
  required = true,
) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    if (required) {
      throw new Error(`${fieldName} is required`);
    }
    return;
  }

  if (!PAKISTAN_MOBILE_REGEX.test(normalizedValue)) {
    throw new Error(`${fieldName} must start with 03 and be 11 digits`);
  }
};

const validateProvince = (value) => {
  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    throw new Error("Province is required");
  }

  if (!VALID_PROVINCES.includes(normalizedValue)) {
    throw new Error(
      `Province must be one of: ${VALID_PROVINCES.join(", ")}`,
    );
  }
};

const validateHusbandName = ({ gender, maritalStatus, husbandName }) => {
  const shouldRequireHusbandName =
    normalizeString(gender) === "Female" &&
    normalizeString(maritalStatus) === "Married";

  if (shouldRequireHusbandName && !normalizeString(husbandName)) {
    throw new Error("Husband name is required for married female employees");
  }
};

const validateEmergencyContacts = (contacts) => {
  if (!Array.isArray(contacts) || contacts.length === 0) {
    throw new Error("At least one emergency contact is required");
  }

  contacts.forEach((contact, index) => {
    validateMobileNumber(
      contact?.number,
      `Emergency contact ${index + 1} number`,
      true,
    );
  });
};

const validateGuarantors = (guarantors) => {
  if (!Array.isArray(guarantors) || guarantors.length === 0) {
    throw new Error("At least one guarantor is required");
  }

  guarantors.forEach((guarantor, index) => {
    validateMobileNumber(
      guarantor?.contactNumber,
      `Guarantor ${index + 1} contact number`,
      true,
    );
    validateCnic(guarantor?.cnic, `Guarantor ${index + 1} CNIC`, true);
    if (!guarantor?.relation?.trim()) {
      throw new Error(`Guarantor ${index + 1} relation is required`);
    }
  });
};

const validateReferences = (references) => {
  if (!Array.isArray(references) || references.length === 0) {
    throw new Error("At least one reference is required");
  }
  references.forEach((ref, index) => {
    if (!ref?.name?.trim()) {
      throw new Error(`Reference ${index + 1} name is required`);
    }
    validateMobileNumber(
      ref?.contactNumber,
      `Reference ${index + 1} contact number`,
      true,
    );
    if (!ref?.relation?.trim()) {
      throw new Error(`Reference ${index + 1} relation is required`);
    }
    if (!ref?.address?.trim()) {
      throw new Error(`Reference ${index + 1} address is required`);
    }
  });
};

// Ensure no two contact-number fields on the same employee share the same value.
const validateContactNumberUniqueness = ({
  contactNumber,
  emergencyContact = [],
  references = [],
  guarantor = [],
}) => {
  const seen = new Map();
  const register = (rawValue, label) => {
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) return;
    if (seen.has(value)) {
      throw new Error(
        `${label} duplicates the number used in ${seen.get(value)}. Each contact number must be unique for an employee.`,
      );
    }
    seen.set(value, label);
  };

  register(contactNumber, "Primary contact");
  (emergencyContact || []).forEach((entry, i) =>
    register(entry?.number, `Emergency contact #${i + 1}`),
  );
  (references || []).forEach((entry, i) =>
    register(entry?.contactNumber, `Reference #${i + 1}`),
  );
  (guarantor || []).forEach((entry, i) =>
    register(entry?.contactNumber, `Guarantor #${i + 1}`),
  );
};

// @description     Create new employee
// @route           POST /api/employees
// @access          Admin
export const createEmployee = async (req, res, next) => {
  try {
    const {
      position,
      basicSalary,
      employeeOf = "Taj Agri",
      allowances,
      leaveEntitlements,
      fullName,
      gender,
      fatherName,
      husbandName,
      joiningDate,
      cnic,
      dob,
      contactNumber,
      province,
      city,
      maritalStatus,
      currentStreetAddress,
      permanentStreetAddress,
      emergencyContact,
      medical,
      education,
      previousExperience,
      guarantor,
      references,
      legal,
    } = req.body;

    // Validate required fields
    if (!fullName?.trim()) {
      res.status(400);
      throw new Error("Full name is required");
    }

    if (!position?.trim()) {
      res.status(400);
      throw new Error("Position is required");
    }

    if (!gender?.trim()) {
      res.status(400);
      throw new Error("Gender is required");
    }

    const parsedEmergencyContact = parseIfString(emergencyContact) || [];
    const parsedMedical = parseIfString(medical) || {};
    const parsedEducation = parseIfString(education) || [];
    const parsedPreviousExperience = parseIfString(previousExperience) || [];
    const parsedGuarantor = parseIfString(guarantor) || [];
    const parsedReferences = parseIfString(references) || [];
    const parsedLegal = parseIfString(legal) || {};

    res.status(400);
    validateCnic(cnic, "CNIC", true);
    validateMobileNumber(contactNumber, "Contact number", true);
    validateProvince(province);
    validateHusbandName({ gender, maritalStatus, husbandName });
    validateEmergencyContacts(parsedEmergencyContact);
    validateGuarantors(parsedGuarantor);
    validateReferences(parsedReferences);
    validateContactNumberUniqueness({
      contactNumber,
      emergencyContact: parsedEmergencyContact,
      references: parsedReferences,
      guarantor: parsedGuarantor,
    });

    // Validate position ID
    if (!mongoose.Types.ObjectId.isValid(position)) {
      res.status(400);
      throw new Error("Invalid position ID");
    }

    // Check if position exists
    const positionDoc = await Position.findById(position);
    if (!positionDoc) {
      res.status(404);
      throw new Error("Position not found");
    }

    const effectiveDate = joiningDate ? new Date(joiningDate) : new Date();
    const resolvedAllowances = await normalizeAllowances(allowances, effectiveDate);
    const resolvedLeaveEntitlements = await normalizeLeaveEntitlements(
      leaveEntitlements,
      effectiveDate,
    );

    // Check position limit for position
    const employeeLimitStr = positionDoc.employeeLimit?.trim().toLowerCase();
    if (employeeLimitStr && employeeLimitStr !== "unlimited") {
      const limit = parseInt(employeeLimitStr, 10);
      if (!isNaN(limit) && positionDoc.hiredEmployees >= limit) {
        res.status(400);
        throw new Error(
          `Position limit reached for ${positionDoc.name} position. Maximum employees allowed: ${limit}`,
        );
      }
    }

    // Check for duplicate CNIC
    if (cnic) {
      const existingEmployee = await Employee.findOne({ cnic: cnic.trim() });
      if (existingEmployee) {
        res.status(400);
        throw new Error("An employee with this CNIC already exists");
      }
    }

    // Generate employee ID
    const employeeID = await generateEmployeeId();

    // Handle employee image uploads
    let employeePicture = null;
    let cnicImages = { front: null, back: null };

    if (req.files) {
      try {
        if (req.files.employeePicture && req.files.employeePicture[0]) {
          const pictureResult = await uploadToCloudinary(
            req.files.employeePicture[0].buffer,
            `taj-hrms/employees/${employeeID}/profile`,
            "picture",
          );
          employeePicture = pictureResult.secure_url;
        }

        if (req.files.cnicFront && req.files.cnicFront[0]) {
          const frontResult = await uploadToCloudinary(
            req.files.cnicFront[0].buffer,
            `taj-hrms/employees/${employeeID}/cnic`,
            "front",
          );
          cnicImages.front = frontResult.secure_url;
        }

        if (req.files.cnicBack && req.files.cnicBack[0]) {
          const backResult = await uploadToCloudinary(
            req.files.cnicBack[0].buffer,
            `taj-hrms/employees/${employeeID}/cnic`,
            "back",
          );
          cnicImages.back = backResult.secure_url;
        }

        // Guarantor documents — files arrive aligned to indices in guarantorDocumentIndices
        if (Array.isArray(req.files.guarantorDocuments)) {
          const docIndices = parseIfString(req.body.guarantorDocumentIndices) || [];
          for (let i = 0; i < req.files.guarantorDocuments.length; i++) {
            const file = req.files.guarantorDocuments[i];
            if (!file) continue;
            const slot = docIndices[i] !== undefined ? Number(docIndices[i]) : i;
            const isPdf = file.mimetype === "application/pdf";
            const docResult = await uploadToCloudinary(
              file.buffer,
              `taj-hrms/employees/${employeeID}/guarantors`,
              `guarantor-${slot}${isPdf ? ".pdf" : ""}`,
              isPdf ? "raw" : "image",
            );
            if (parsedGuarantor[slot]) {
              parsedGuarantor[slot].documentUrl = docResult.secure_url;
            }
          }
        }
      } catch (uploadError) {
        res.status(500);
        throw new Error(`Failed to upload employee images: ${uploadError.message}`, {
          cause: uploadError,
        });
      }
    }

    // Create employee
    const newEmployee = new Employee({
      employeeID,
      position,
      employeeOf,
      basicSalary: basicSalary ? Number(basicSalary) : 0,
      allowances: resolvedAllowances,
      leaveEntitlements: resolvedLeaveEntitlements,
      status: "Active",
      fullName: fullName.trim(),
      gender,
      fatherName: fatherName?.trim() || "",
      husbandName:
        gender === "Female" && maritalStatus === "Married"
          ? husbandName?.trim() || ""
          : "",
      joiningDate: joiningDate || new Date(),
      employeePicture,
      cnic: cnic?.trim() || "",
      cnicImages,
      dob: dob || null,
      contactNumber: contactNumber?.trim() || "",
      province: province?.trim() || "",
      city: city?.trim() || "",
      maritalStatus: maritalStatus || "Single",
      currentStreetAddress: currentStreetAddress?.trim() || "",
      permanentStreetAddress: permanentStreetAddress?.trim() || "",
      emergencyContact: parsedEmergencyContact,
      medical: parsedMedical,
      education: parsedEducation,
      previousExperience: parsedPreviousExperience,
      guarantor: parsedGuarantor,
      references: parsedReferences,
      legal: parsedLegal,
    });

    const savedEmployee = await newEmployee.save();

    // Increment hired employees count in position
    await Position.findByIdAndUpdate(position, { $inc: { hiredEmployees: 1 } });

    // Increment employee count in department
    await Department.findByIdAndUpdate(positionDoc.department, {
      $inc: { employeeCount: 1 },
    });

    const leaveBalances = await syncLeaveBalancesFromEntitlements(
      savedEmployee._id,
      resolvedLeaveEntitlements,
      effectiveDate.getFullYear(),
    );

    // Create initial position history record
    await PositionHistory.create({
      employee: savedEmployee._id,
      fromPosition: null,
      toPosition: position,
      changedBy: req.user._id,
      reason: "Initial assignment on employee creation",
    });

    await EmployeeAllowanceHistory.create({
      employee: savedEmployee._id,
      fromAllowances: [],
      toAllowances: resolvedAllowances,
      changedBy: req.user._id,
      effectiveDate,
      reason: "Initial allowance setup on employee creation",
    });

    await EmployeeLeaveEntitlementHistory.create({
      employee: savedEmployee._id,
      fromEntitlements: [],
      toEntitlements: resolvedLeaveEntitlements,
      changedBy: req.user._id,
      effectiveDate,
      reason: "Initial leave entitlement setup on employee creation",
    });

    // Populate references for response
    const populatedEmployee = await Employee.findById(savedEmployee._id)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate("allowances.allowanceComponent", "name")
      .populate("leaveEntitlements.leaveType", "name");

    res.status(201).json({
      employee: populatedEmployee,
      leaveBalancesCreated: leaveBalances.length,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all employees
// @route           GET /api/employees
// @access          Admin, Supervisor
export const getAllEmployees = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";
    const statusFilter = req.query.status || "";
    const typeFilter = req.query.type || "";
    const positionFilter = req.query.position || ""; // Position Name
    const departmentFilter = req.query.department || ""; // Department ID
    const shiftFilter = req.query.shift || ""; // Shift ID

    // Build search and filter query
    const query = {};

    // Search by name, employeeID, or CNIC
    if (searchText.trim()) {
      query.$or = [
        { fullName: { $regex: searchText.trim(), $options: "i" } },
        { employeeID: { $regex: searchText.trim(), $options: "i" } },
        { cnic: { $regex: searchText.trim(), $options: "i" } },
      ];
    }

    // Filter by status
    if (statusFilter.trim()) {
      query.status = statusFilter.trim();
    }

    // Filter by employment type
    if (typeFilter.trim()) {
      query.employmentType = typeFilter.trim();
    }

    // Filter by Department and/or Position Name
    const positionQuery = {};
    if (departmentFilter.trim()) {
      positionQuery.department = departmentFilter.trim();
    }
    if (positionFilter.trim()) {
      // Exact match for name if selected from dropdown, or regex if manual
      // Assuming dropdown sends exact name
      positionQuery.name = positionFilter.trim();
    }

    if (Object.keys(positionQuery).length > 0) {
      const validPositionIds =
        await Position.find(positionQuery).distinct("_id");
      // If we are filtering by position/dept but found no matching positions,
      // we should ensure the query returns no employees.
      if (validPositionIds.length === 0) {
        // Impossible ID to ensure no results
        query.position = new mongoose.Types.ObjectId();
      } else {
        query.position = { $in: validPositionIds };
      }
    }

    // Filter by Shift
    if (shiftFilter.trim()) {
      const shiftEmployeeIds = await EmployeeShift.find({
        shift: shiftFilter.trim(),
        endDate: null,
      }).distinct("employee");

      // Merge with existing _id filter if any (unlikely in this context so far)
      if (query._id) {
        query._id = { $in: shiftEmployeeIds, ...query._id };
      } else {
        query._id = { $in: shiftEmployeeIds };
      }
    }

    // Calculate skip value for pagination
    const skip = limit > 0 ? (page - 1) * limit : 0;

    // Get total count for pagination metadata
    const totalEmployees = await Employee.countDocuments(query);

    // Get paginated employees
    let employeesQuery = Employee.find(query)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate("allowances.allowanceComponent", "name")
      .sort({ createdAt: -1 });

    // Only apply skip and limit if limit is greater than 0
    if (limit > 0) {
      employeesQuery = employeesQuery.skip(skip).limit(limit);
    }

    let employees = await employeesQuery.lean();

    // Fetch current shifts for all employees in one query
    const employeeIds = employees.map((emp) => emp._id);
    const currentShifts = await EmployeeShift.find({
      employee: { $in: employeeIds },
      endDate: null,
    })
      .populate("shift", "name startTime endTime")
      .lean();

    // Create a map for quick lookup
    const shiftMap = new Map();
    for (const cs of currentShifts) {
      shiftMap.set(cs.employee.toString(), {
        ...cs.shift,
        effectiveDate: cs.effectiveDate,
      });
    }

    // Attach current shift to each employee
    employees = employees.map((emp) => ({
      ...emp,
      currentShift: shiftMap.get(emp._id.toString()) || null,
    }));

    res.json({
      employees,
      pagination: {
        currentPage: page,
        totalPages: limit > 0 ? Math.ceil(totalEmployees / limit) : 1,
        totalEmployees,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get single employee by ID
// @route           GET /api/employees/:id
// @access          Admin
export const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const employee = await Employee.findById(id)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate("allowances.allowanceComponent", "name")
      .populate("leaveEntitlements.leaveType", "name");

    if (!employee) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    // Get leave balances
    const leaveBalances = await LeaveBalance.find({ employee: id })
      .populate("leaveType", "name isPaid")
      .sort({ year: -1 });

    const currentShiftAssignment = await EmployeeShift.findOne({
      employee: id,
      endDate: null,
    })
      .populate("shift", "name startTime endTime")
      .lean();

    res.json({
      employee,
      leaveBalances,
      currentShift: currentShiftAssignment?.shift
        ? {
            ...currentShiftAssignment.shift,
            effectiveDate: currentShiftAssignment.effectiveDate,
          }
        : null,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update employee
// @route           PUT /api/employees/:id
// @access          Admin
export const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const employee = await Employee.findById(id);

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const {
      fullName,
      gender,
      fatherName,
      husbandName,
      joiningDate,
      cnic,
      dob,
      contactNumber,
      province,
      city,
      maritalStatus,
      currentStreetAddress,
      permanentStreetAddress,
      emergencyContact,
      medical,
      education,
      previousExperience,
      guarantor,
      references,
      legal,
      position,
      basicSalary,
      employeeOf,
      allowances,
      leaveEntitlements,
      employmentType,
      compensationEffectiveDate,
      salaryEffectiveDate,
      allowanceEffectiveDate,
      compensationChangeReason,
    } = req.body;

    const parsedEmergencyContact =
      emergencyContact !== undefined
        ? parseIfString(emergencyContact) || []
        : employee.emergencyContact || [];
    const parsedMedical =
      medical !== undefined ? parseIfString(medical) || {} : employee.medical || {};
    const parsedEducation =
      education !== undefined
        ? parseIfString(education) || []
        : employee.education || [];
    const parsedPreviousExperience =
      previousExperience !== undefined
        ? parseIfString(previousExperience) || []
        : employee.previousExperience || [];
    const parsedGuarantor =
      guarantor !== undefined
        ? parseIfString(guarantor) || []
        : employee.guarantor || [];
    const parsedReferences =
      references !== undefined
        ? parseIfString(references) || []
        : employee.references || [];
    const parsedLegal =
      legal !== undefined ? parseIfString(legal) || {} : employee.legal || {};
    const nextGender = gender || employee.gender;
    const nextMaritalStatus = maritalStatus || employee.maritalStatus;
    const nextHusbandName =
      husbandName !== undefined ? husbandName : employee.husbandName;
    const nextCnic = cnic !== undefined ? cnic : employee.cnic;
    const nextContactNumber =
      contactNumber !== undefined ? contactNumber : employee.contactNumber;
    const nextProvince = province !== undefined ? province : employee.province;

    const nextBasicSalaryCandidate =
      basicSalary !== undefined ? Number(basicSalary) || 0 : Number(employee.basicSalary || 0);
    const currentBasicSalary = Number(employee.basicSalary || 0);

    const salaryEffectiveDateInput = salaryEffectiveDate || compensationEffectiveDate;
    const allowanceEffectiveDateInput = allowanceEffectiveDate || compensationEffectiveDate;

    const nextAllowanceCandidate =
      allowances !== undefined
        ? await normalizeAllowances(
            allowances,
            allowanceEffectiveDateInput || new Date(),
          )
        : employee.allowances || [];
    const currentAllowanceSignature = getPayrollAllowanceSignature(
      employee.allowances || [],
    );
    const nextAllowanceSignature = getPayrollAllowanceSignature(nextAllowanceCandidate);

    const hasBasicSalaryChangeInput = nextBasicSalaryCandidate !== currentBasicSalary;
    const hasAllowanceChangeInput = nextAllowanceSignature !== currentAllowanceSignature;

    if (hasBasicSalaryChangeInput && !salaryEffectiveDateInput) {
      res.status(400);
      throw new Error(
        "Salary effective date is required when changing basic salary"
      );
    }

    if (hasAllowanceChangeInput && !allowanceEffectiveDateInput) {
      res.status(400);
      throw new Error(
        "Allowance effective date is required when changing allowances"
      );
    }

    const parsedSalaryEffectiveDate = salaryEffectiveDateInput
      ? new Date(salaryEffectiveDateInput)
      : new Date();
    const parsedAllowanceEffectiveDate = allowanceEffectiveDateInput
      ? new Date(allowanceEffectiveDateInput)
      : new Date();

    if (
      hasBasicSalaryChangeInput &&
      Number.isNaN(parsedSalaryEffectiveDate.getTime())
    ) {
      res.status(400);
      throw new Error("Invalid salary effective date");
    }

    if (hasBasicSalaryChangeInput && isFutureEffectiveDate(parsedSalaryEffectiveDate)) {
      res.status(400);
      throw new Error("Salary effective date cannot be in the future");
    }

    if (
      hasAllowanceChangeInput &&
      Number.isNaN(parsedAllowanceEffectiveDate.getTime())
    ) {
      res.status(400);
      throw new Error("Invalid allowance effective date");
    }

    if (hasAllowanceChangeInput && isFutureEffectiveDate(parsedAllowanceEffectiveDate)) {
      res.status(400);
      throw new Error("Allowance effective date cannot be in the future");
    }

    res.status(400);
    validateCnic(nextCnic, "CNIC", true);
    validateMobileNumber(nextContactNumber, "Contact number", true);
    validateProvince(nextProvince);
    validateHusbandName({
      gender: nextGender,
      maritalStatus: nextMaritalStatus,
      husbandName: nextHusbandName,
    });
    validateEmergencyContacts(parsedEmergencyContact);
    validateGuarantors(parsedGuarantor);
    if (references !== undefined) {
      validateReferences(parsedReferences);
    }
    validateContactNumberUniqueness({
      contactNumber: nextContactNumber,
      emergencyContact: parsedEmergencyContact,
      references: parsedReferences,
      guarantor: parsedGuarantor,
    });

    // Check for duplicate CNIC if changed
    if (cnic && cnic.trim() !== employee.cnic) {
      const existingEmployee = await Employee.findOne({
        cnic: cnic.trim(),
        _id: { $ne: id },
      });
      if (existingEmployee) {
        res.status(400);
        throw new Error("An employee with this CNIC already exists");
      }
    }

    // Handle employee image uploads
    if (req.files) {
      try {
        if (req.files.employeePicture && req.files.employeePicture[0]) {
          const pictureResult = await uploadToCloudinary(
            req.files.employeePicture[0].buffer,
            `taj-hrms/employees/${employee.employeeID}/profile`,
            "picture",
          );
          employee.employeePicture = pictureResult.secure_url;
        }

        if (req.files.cnicFront && req.files.cnicFront[0]) {
          const frontResult = await uploadToCloudinary(
            req.files.cnicFront[0].buffer,
            `taj-hrms/employees/${employee.employeeID}/cnic`,
            "front",
          );
          employee.cnicImages = employee.cnicImages || {};
          employee.cnicImages.front = frontResult.secure_url;
        }

        if (req.files.cnicBack && req.files.cnicBack[0]) {
          const backResult = await uploadToCloudinary(
            req.files.cnicBack[0].buffer,
            `taj-hrms/employees/${employee.employeeID}/cnic`,
            "back",
          );
          employee.cnicImages = employee.cnicImages || {};
          employee.cnicImages.back = backResult.secure_url;
        }

        // Guarantor documents — files arrive aligned to indices in guarantorDocumentIndices
        if (Array.isArray(req.files.guarantorDocuments)) {
          const docIndices = parseIfString(req.body.guarantorDocumentIndices) || [];
          for (let i = 0; i < req.files.guarantorDocuments.length; i++) {
            const file = req.files.guarantorDocuments[i];
            if (!file) continue;
            const slot = docIndices[i] !== undefined ? Number(docIndices[i]) : i;
            const isPdf = file.mimetype === "application/pdf";
            const docResult = await uploadToCloudinary(
              file.buffer,
              `taj-hrms/employees/${employee.employeeID}/guarantors`,
              `guarantor-${slot}-${Date.now()}${isPdf ? ".pdf" : ""}`,
              isPdf ? "raw" : "image",
            );
            if (parsedGuarantor[slot]) {
              parsedGuarantor[slot].documentUrl = docResult.secure_url;
            }
          }
        }
      } catch (uploadError) {
        res.status(500);
        throw new Error(`Failed to upload employee images: ${uploadError.message}`, {
          cause: uploadError,
        });
      }
    }

    // Track changes for response
    let positionChanged = false;
    let leaveBalanceChanges = [];

    // Handle position change
    if (position && position !== employee.position?.toString()) {
      if (!mongoose.Types.ObjectId.isValid(position)) {
        res.status(400);
        throw new Error("Invalid position ID");
      }

      const oldPositionDoc = await Position.findById(employee.position);
      const newPositionDoc = await Position.findById(position);

      if (!newPositionDoc) {
        res.status(404);
        throw new Error("Position not found");
      }

      // Check position limit for new position
      const employeeLimitStr = newPositionDoc.employeeLimit
        ?.trim()
        .toLowerCase();
      if (employee.status === "Active" && employeeLimitStr && employeeLimitStr !== "unlimited") {
        const limit = parseInt(employeeLimitStr, 10);
        if (!isNaN(limit) && newPositionDoc.hiredEmployees >= limit) {
          res.status(400);
          throw new Error(
            `Position limit reached for ${newPositionDoc.name} position. Maximum employees allowed: ${limit}`,
          );
        }
      }

      const fromPosition = employee.position;
      const effectiveDate = new Date();

      // Create position history record
      await PositionHistory.create({
        employee: id,
        fromPosition,
        toPosition: position,
        changedBy: req.user._id,
        effectiveDate,
        reason: "Updated via employee edit form",
      });

      if (employee.status === "Active") {
        // Decrement count from old position
        await Position.findByIdAndUpdate(fromPosition, {
          $inc: { hiredEmployees: -1 },
        });
        // Increment count for new position
        await Position.findByIdAndUpdate(position, {
          $inc: { hiredEmployees: 1 },
        });

        // Handle department employee count if department changes
        const oldDepartmentId = oldPositionDoc?.department?.toString();
        const newDepartmentId = newPositionDoc.department?.toString();

        if (oldDepartmentId && newDepartmentId && oldDepartmentId !== newDepartmentId) {
          // Decrement count from old department
          await Department.findByIdAndUpdate(oldDepartmentId, {
            $inc: { employeeCount: -1 },
          });
          // Increment count for new department
          await Department.findByIdAndUpdate(newDepartmentId, {
            $inc: { employeeCount: 1 },
          });
        }
      }

      employee.position = position;
      positionChanged = true;
    }

    // Handle basic salary change
    if (basicSalary !== undefined) {
      const nextBasicSalary = Number(basicSalary) || 0;
      const previousBasicSalary = Number(employee.basicSalary || 0);

      if (nextBasicSalary !== previousBasicSalary) {
        const existingSalaryHistoryOnSameDate = await BasicSalaryHistory.findOne({
          employee: id,
          effectiveDate: parsedSalaryEffectiveDate,
          toBasicSalary: { $ne: nextBasicSalary },
        });

        if (existingSalaryHistoryOnSameDate) {
          res.status(400);
          throw new Error(
            "A different basic salary change already exists for the same effective date"
          );
        }

        await BasicSalaryHistory.create({
          employee: id,
          fromBasicSalary: previousBasicSalary,
          toBasicSalary: nextBasicSalary,
          changedBy: req.user._id,
          effectiveDate: parsedSalaryEffectiveDate,
          reason: compensationChangeReason || "Updated via employee edit form",
        });
      }

      employee.basicSalary = nextBasicSalary;
    }

    if (employeeOf !== undefined && employeeOf !== "") {
      employee.employeeOf = employeeOf;
    }

    // Handle employment type change
    if (employmentType && employmentType !== employee.employmentType) {
      const validTypes = ["Permanent", "Contract", "Part Time"];
      if (!validTypes.includes(employmentType)) {
        res.status(400);
        throw new Error(
          `Invalid employment type. Must be one of: ${validTypes.join(", ")}`,
        );
      }
      employee.employmentType = employmentType;
    }

    // Update other fields
    if (fullName?.trim()) employee.fullName = fullName.trim();
    if (gender) employee.gender = gender;
    if (fatherName !== undefined)
      employee.fatherName = fatherName?.trim() || "";
    if (husbandName !== undefined)
      employee.husbandName =
        nextGender === "Female" && nextMaritalStatus === "Married"
          ? husbandName?.trim() || ""
          : "";
    if (joiningDate) employee.joiningDate = joiningDate;
    if (cnic !== undefined) employee.cnic = cnic?.trim() || "";
    if (dob !== undefined) employee.dob = dob || null;
    if (contactNumber !== undefined)
      employee.contactNumber = contactNumber?.trim() || "";
    if (province !== undefined) employee.province = province?.trim() || "";
    if (city !== undefined) employee.city = city?.trim() || "";
    if (maritalStatus) employee.maritalStatus = maritalStatus;
    if (currentStreetAddress !== undefined)
      employee.currentStreetAddress = currentStreetAddress?.trim() || "";
    if (permanentStreetAddress !== undefined)
      employee.permanentStreetAddress = permanentStreetAddress?.trim() || "";
    if (emergencyContact !== undefined)
      employee.emergencyContact = parsedEmergencyContact;
    if (medical !== undefined) employee.medical = parsedMedical;
    if (education !== undefined)
      employee.education = parsedEducation;
    if (previousExperience !== undefined)
      employee.previousExperience = parsedPreviousExperience;
    if (guarantor !== undefined)
      employee.guarantor = parsedGuarantor;
    if (references !== undefined)
      employee.references = parsedReferences;
    if (legal !== undefined) employee.legal = parsedLegal;

    if (
      (gender !== undefined || maritalStatus !== undefined) &&
      !(nextGender === "Female" && nextMaritalStatus === "Married")
    ) {
      employee.husbandName = "";
    }

    if (allowances !== undefined && nextAllowanceSignature !== currentAllowanceSignature) {
      await EmployeeAllowanceHistory.create({
        employee: id,
        fromAllowances: employee.allowances || [],
        toAllowances: nextAllowanceCandidate,
        changedBy: req.user._id,
        effectiveDate: parsedAllowanceEffectiveDate,
        reason: compensationChangeReason || "Updated via employee edit form",
      });
      employee.allowances = nextAllowanceCandidate;
    }

    if (leaveEntitlements !== undefined) {
      const effectiveDate = compensationEffectiveDate || new Date();
      const nextLeaveEntitlements = await normalizeLeaveEntitlements(
        leaveEntitlements,
        effectiveDate,
      );
      const currentLeaveSignature = JSON.stringify(
        (employee.leaveEntitlements || []).map((item) => ({
          leaveType: item.leaveType?.toString(),
          enabled: Boolean(item.enabled),
          annualDays: Number(item.annualDays || 0),
          method: item.method || "Fixed",
          autoManaged: Boolean(item.autoManaged),
        })),
      );
      const nextLeaveSignature = JSON.stringify(
        nextLeaveEntitlements.map((item) => ({
          leaveType: item.leaveType?.toString(),
          enabled: Boolean(item.enabled),
          annualDays: Number(item.annualDays || 0),
          method: item.method || "Fixed",
          autoManaged: Boolean(item.autoManaged),
        })),
      );

      if (currentLeaveSignature !== nextLeaveSignature) {
        await EmployeeLeaveEntitlementHistory.create({
          employee: id,
          fromEntitlements: employee.leaveEntitlements || [],
          toEntitlements: nextLeaveEntitlements,
          changedBy: req.user._id,
          effectiveDate,
          reason: compensationChangeReason || "Updated via employee edit form",
        });
        employee.leaveEntitlements = nextLeaveEntitlements;
        leaveBalanceChanges = await syncLeaveBalancesFromEntitlements(
          id,
          nextLeaveEntitlements,
          new Date(effectiveDate).getFullYear(),
        );
      }
    }

    const updatedEmployee = await employee.save();

    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      })
      .populate("allowances.allowanceComponent", "name")
      .populate("leaveEntitlements.leaveType", "name");

    res.status(200).json({
      employee: populatedEmployee,
      positionChanged,
      leaveBalanceChanges,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Change employee status
// @route           PATCH /api/employees/:id/status
// @access          Admin
export const changeEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const validStatuses = ["Active", "Inactive", "Resigned", "Terminated"];
    if (!status || !validStatuses.includes(status)) {
      res.status(400);
      throw new Error(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    const employee = await Employee.findById(id).populate(
      "position",
      "department",
    );

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const previousStatus = employee.status;
    employee.status = status;

    // If employee is being deactivated, decrement hired count
    if (previousStatus === "Active" && status !== "Active") {
      await Position.findByIdAndUpdate(employee.position._id, {
        $inc: { hiredEmployees: -1 },
      });
      // Also decrement department employee count
      await Department.findByIdAndUpdate(employee.position.department, {
        $inc: { employeeCount: -1 },
      });
    }
    // If employee is being reactivated, increment hired count
    else if (previousStatus !== "Active" && status === "Active") {
      await Position.findByIdAndUpdate(employee.position._id, {
        $inc: { hiredEmployees: 1 },
      });
      // Also increment department employee count
      await Department.findByIdAndUpdate(employee.position.department, {
        $inc: { employeeCount: 1 },
      });
    }

    const updatedEmployee = await employee.save();

    res.json({
      message: `Employee status changed from ${previousStatus} to ${status}`,
      employee: updatedEmployee,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Change employee position
// @route           PATCH /api/employees/:id/position
// @access          Admin
export const changeEmployeePosition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPosition, effectiveDate, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    if (!newPosition) {
      res.status(400);
      throw new Error("New position is required");
    }

    if (!mongoose.Types.ObjectId.isValid(newPosition)) {
      res.status(400);
      throw new Error("Invalid position ID");
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (employee.status !== "Active") {
      res.status(400);
      throw new Error("Only active employees can be transferred");
    }

    if (employee.position?.toString() === newPosition.toString()) {
      res.status(400);
      throw new Error("New position must be different from current position");
    }

    const parsedEffectiveDate = effectiveDate
      ? new Date(effectiveDate)
      : new Date();
    if (Number.isNaN(parsedEffectiveDate.getTime())) {
      res.status(400);
      throw new Error("Invalid effective date");
    }

    if (
      employee.joiningDate &&
      parsedEffectiveDate < new Date(employee.joiningDate)
    ) {
      res.status(400);
      throw new Error("Effective date cannot be before joining date");
    }

    const oldPositionDoc = await Position.findById(employee.position);
    const newPositionDoc = await Position.findById(newPosition);

    if (!oldPositionDoc) {
      res.status(404);
      throw new Error("Current position not found");
    }

    if (!newPositionDoc) {
      res.status(404);
      throw new Error("Position not found");
    }

    // Check position limit for new position
    const employeeLimitStr = newPositionDoc.employeeLimit?.trim().toLowerCase();
    if (employeeLimitStr && employeeLimitStr !== "unlimited") {
      const limit = parseInt(employeeLimitStr, 10);
      if (!isNaN(limit) && newPositionDoc.hiredEmployees >= limit) {
        res.status(400);
        throw new Error(
          `Position limit reached for ${newPositionDoc.name} position. Maximum employees allowed: ${limit}`,
        );
      }
    }

    const fromPosition = employee.position;

    // Create position history record
    await PositionHistory.create({
      employee: id,
      fromPosition,
      toPosition: newPosition,
      changedBy: req.user._id,
      effectiveDate: parsedEffectiveDate,
      reason: reason || "",
    });

    // Decrement count from old position
    await Position.findByIdAndUpdate(fromPosition, {
      $inc: { hiredEmployees: -1 },
    });
    // Increment count for new position
    await Position.findByIdAndUpdate(newPosition, {
      $inc: { hiredEmployees: 1 },
    });

    // Handle department employee count if department changes
    const oldDepartmentId = oldPositionDoc?.department?.toString();
    const newDepartmentId = newPositionDoc.department?.toString();

    if (oldDepartmentId !== newDepartmentId) {
      // Decrement count from old department
      await Department.findByIdAndUpdate(oldDepartmentId, {
        $inc: { employeeCount: -1 },
      });
      // Increment count for new department
      await Department.findByIdAndUpdate(newDepartmentId, {
        $inc: { employeeCount: 1 },
      });
    }

    // Update employee
    employee.position = newPosition;
    const updatedEmployee = await employee.save();

    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate({
        path: "position",
        select: "name department",
        populate: { path: "department", select: "name" },
      });

    res.json({
      message: "Employee position changed successfully",
      employee: populatedEmployee,
      effectiveDate: parsedEffectiveDate,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get employee position history
// @route           GET /api/employees/:id/position-history
// @access          Admin
export const getEmployeePositionHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const employee = await Employee.findById(id).select("fullName employeeID");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const positionHistory = await PositionHistory.find({ employee: id })
      .populate("fromPosition", "name")
      .populate("toPosition", "name")
      .populate("changedBy", "name")
      .sort({ changedAt: -1 });

    res.json({
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      positionHistory,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get employee compensation history (salary + allowances)
// @route           GET /api/employees/:id/compensation-history
// @access          Admin
export const getEmployeeCompensationHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const employee = await Employee.findById(id).select("fullName employeeID");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const [basicSalaryHistory, allowanceHistory] = await Promise.all([
      BasicSalaryHistory.find({ employee: id })
        .populate("changedBy", "name")
        .sort({ effectiveDate: -1, changedAt: -1 }),
      EmployeeAllowanceHistory.find({ employee: id })
        .populate("fromAllowances.allowanceComponent", "name")
        .populate("toAllowances.allowanceComponent", "name")
        .populate("changedBy", "name")
        .sort({ effectiveDate: -1, changedAt: -1 }),
    ]);

    res.json({
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      basicSalaryHistory,
      allowanceHistory,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get employees list (for dropdowns)
// @route           GET /api/employees/list
// @access          Admin
export const getEmployeesList = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);

    const filter = { status: "Active" };
    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: "i" } },
        { employeeID: { $regex: q, $options: "i" } },
      ];
    }

    const employees = await Employee.find(filter)
      .select("_id fullName employeeID position")
      .populate("position", "name")
      .sort({ fullName: 1 })
      .limit(limit)
      .lean();

    res.json({ employees });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Renew leave balances for new year (for a single employee)
// @route           POST /api/employees/:id/renew-leave-balances
// @access          Admin
export const renewEmployeeLeaveBalances = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { year } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const targetYear = year || new Date().getFullYear();

    const employee = await Employee.findById(id).populate("leaveEntitlements.leaveType", "name");

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    // Check if leave balances already exist for this year
    const existingBalances = await LeaveBalance.find({
      employee: id,
      year: targetYear,
    });

    if (existingBalances.length > 0) {
      res.status(400);
      throw new Error(
        `Leave balances for year ${targetYear} already exist for this employee`,
      );
    }

    const createdBalances = await syncLeaveBalancesFromEntitlements(
      id,
      employee.leaveEntitlements,
      targetYear,
    );
    const newBalances = createdBalances.map((balance) => ({
      leaveType: balance.leaveType?.name || balance.leaveType?.toString(),
      totalDays: balance.totalDays,
    }));

    res.status(201).json({
      message: `Leave balances renewed for year ${targetYear}`,
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      year: targetYear,
      balancesCreated: newBalances,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Bulk renew leave balances for all active employees for new year
// @route           POST /api/employees/renew-all-leave-balances
// @access          Admin
export const renewAllEmployeesLeaveBalances = async (req, res, next) => {
  try {
    const { year } = req.body;
    const targetYear = year || new Date().getFullYear();

    const employees = await Employee.find({ status: "Active" }).populate(
      "leaveEntitlements.leaveType",
      "name",
    );

    const results = {
      success: [],
      skipped: [],
      errors: [],
    };

    for (const employee of employees) {
      try {
        if (!employee.leaveEntitlements?.length) {
          results.skipped.push({
            employeeID: employee.employeeID,
            fullName: employee.fullName,
            reason: "No leave entitlements configured",
          });
          continue;
        }

        // Check if leave balances already exist for this year
        const existingBalances = await LeaveBalance.find({
          employee: employee._id,
          year: targetYear,
        });

        if (existingBalances.length > 0) {
          results.skipped.push({
            employeeID: employee.employeeID,
            fullName: employee.fullName,
            reason: `Leave balances for ${targetYear} already exist`,
          });
          continue;
        }

        const createdBalances = await syncLeaveBalancesFromEntitlements(
          employee._id,
          employee.leaveEntitlements,
          targetYear,
        );

        results.success.push({
          employeeID: employee.employeeID,
          fullName: employee.fullName,
          balancesCreated: createdBalances.length,
        });
      } catch (error) {
        results.errors.push({
          employeeID: employee.employeeID,
          fullName: employee.fullName,
          error: error.message,
        });
      }
    }

    res.json({
      message: `Bulk leave balance renewal completed for year ${targetYear}`,
      year: targetYear,
      summary: {
        totalProcessed: employees.length,
        successful: results.success.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
      },
      results,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get employee leave balances for a specific year
// @route           GET /api/employees/:id/leave-balances
// @access          Admin
export const getEmployeeLeaveBalances = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { year } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    const employee = await Employee.findById(id).select("fullName employeeID");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const query = { employee: id };
    if (year) {
      query.year = parseInt(year, 10);
    }

    const leaveBalances = await LeaveBalance.find(query)
      .populate("leaveType", "name isPaid")
      .sort({ year: -1, "leaveType.name": 1 });

    // Group by year
    const balancesByYear = {};
    for (const balance of leaveBalances) {
      if (!balancesByYear[balance.year]) {
        balancesByYear[balance.year] = [];
      }
      balancesByYear[balance.year].push(balance);
    }

    res.json({
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      leaveBalances: balancesByYear,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     End employment (terminate or resign) with an effective date.
//                  Sets final status and reason for payroll cut-off.
// @route           POST /api/employees/:id/end-employment
// @access          Admin
export const endEmployment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { effectiveDate, reason, mode } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee not found");
    }
    if (!effectiveDate) {
      res.status(400);
      throw new Error("Effective date is required");
    }
    if (!reason || !String(reason).trim()) {
      res.status(400);
      throw new Error("Reason is required");
    }
    const endStatus = mode === "Terminated" ? "Terminated" : "Resigned";

    const parsedDate = new Date(effectiveDate);
    if (Number.isNaN(parsedDate.getTime())) {
      res.status(400);
      throw new Error("Invalid effective date");
    }

    const employee = await Employee.findById(id).populate(
      "position",
      "department",
    );
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (employee.status !== "Active") {
      res.status(400);
      throw new Error("Only active employees can be ended");
    }

    if (employee.joiningDate && parsedDate < new Date(employee.joiningDate)) {
      res.status(400);
      throw new Error("Effective date cannot be before joining date");
    }

    const previousStatus = employee.status;
    employee.status = endStatus;
    employee.resignationDate = parsedDate;
    employee.resignationReason = String(reason).trim();
    await employee.save();

    if (previousStatus === "Active") {
      if (employee.position?._id) {
        await Position.findByIdAndUpdate(employee.position._id, {
          $inc: { hiredEmployees: -1 },
        });
      }
      if (employee.position?.department) {
        await Department.findByIdAndUpdate(employee.position.department, {
          $inc: { employeeCount: -1 },
        });
      }
    }

    res.json({
      message: "Employment ended successfully",
      employee: {
        _id: employee._id,
        status: employee.status,
        resignationDate: employee.resignationDate,
        resignationReason: employee.resignationReason,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Rejoin a previously ended employee. Records the prior
//                  employment spell, clears resignation, sets a new joining
//                  date and resets current-year leave balances.
// @route           POST /api/employees/:id/rejoin
// @access          Admin
export const rejoinEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { joiningDate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee not found");
    }
    if (!joiningDate) {
      res.status(400);
      throw new Error("Rejoin date is required");
    }
    const parsedJoining = new Date(joiningDate);
    if (Number.isNaN(parsedJoining.getTime())) {
      res.status(400);
      throw new Error("Invalid rejoin date");
    }

    const employee = await Employee.findById(id).populate(
      "position",
      "department employeeLimit hiredEmployees name",
    );
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (employee.status === "Active") {
      res.status(400);
      throw new Error("Employee is already active");
    }

    if (
      employee.resignationDate &&
      parsedJoining <= new Date(employee.resignationDate)
    ) {
      res.status(400);
      throw new Error("Rejoin date must be after the previous leaving date");
    }

    // Re-check position capacity before reactivating.
    if (employee.position?._id) {
      const positionDoc = employee.position;
      const limitStr = positionDoc.employeeLimit?.trim().toLowerCase();
      if (limitStr && limitStr !== "unlimited") {
        const limit = parseInt(limitStr, 10);
        if (!Number.isNaN(limit) && positionDoc.hiredEmployees >= limit) {
          res.status(400);
          throw new Error(
            `Position limit reached for ${positionDoc.name}. Cannot rejoin.`,
          );
        }
      }
    }

    // Snapshot the prior employment spell.
    employee.employmentHistory = employee.employmentHistory || [];
    employee.employmentHistory.push({
      joiningDate: employee.joiningDate || null,
      resignationDate: employee.resignationDate || null,
      status: ["Resigned", "Terminated"].includes(employee.status)
        ? employee.status
        : "Resigned",
      resignationReason: employee.resignationReason || "",
      endedBy: req.user?._id,
      rejoinedAt: new Date(),
      rejoinedBy: req.user?._id,
    });

    employee.status = "Active";
    employee.joiningDate = parsedJoining;
    employee.resignationDate = null;
    employee.resignationReason = "";
    await employee.save();

    // Bump capacity counters back up.
    if (employee.position?._id) {
      await Position.findByIdAndUpdate(employee.position._id, {
        $inc: { hiredEmployees: 1 },
      });
      if (employee.position.department) {
        await Department.findByIdAndUpdate(employee.position.department, {
          $inc: { employeeCount: 1 },
        });
      }
    }

    // Reset current-year leave balances based on entitlements.
    const populatedEmp = await Employee.findById(id).populate(
      "leaveEntitlements.leaveType",
      "name",
    );
    const targetYear = parsedJoining.getFullYear();
    await LeaveBalance.deleteMany({ employee: id, year: targetYear });
    await syncLeaveBalancesFromEntitlements(
      id,
      populatedEmp.leaveEntitlements,
      targetYear,
    );

    res.json({
      message: "Employee rejoined successfully",
      employee: {
        _id: employee._id,
        status: employee.status,
        joiningDate: employee.joiningDate,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get payroll list for an employee (paginated).
// @route           GET /api/employees/:id/payrolls
// @access          Admin, Supervisor
export const getEmployeePayrolls = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
    const skip = (page - 1) * limit;

    const filter = { employee: id };
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.month) filter.month = Number(req.query.month);

    const [payrolls, total] = await Promise.all([
      Payroll.find(filter)
        .select(
          "year month calculations.netSalary calculations.totalSalary calculations.grossSalary calculations.basicSalaryAmount calculations.allowanceAmount calculations.totalDeductions isPaid paidAt generatedAt",
        )
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payroll.countDocuments(filter),
    ]);

    res.json({
      payrolls,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all leave applications for an employee (paginated).
// @route           GET /api/employees/:id/leave-applications
// @access          Admin, Supervisor
export const getEmployeeLeaveApplications = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Employee not found");
    }

    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
    const skip = (page - 1) * limit;

    const filter = { employee: id };
    if (req.query.status) filter.status = req.query.status;

    const [applications, total] = await Promise.all([
      LeaveApplication.find(filter)
        .populate("leaveType", "name isPaid")
        .populate("appliedBy", "name")
        .populate("approvedBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LeaveApplication.countDocuments(filter),
    ]);

    res.json({
      applications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
