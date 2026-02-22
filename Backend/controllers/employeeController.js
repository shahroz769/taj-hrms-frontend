import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import Department from "../models/Department.js";
import LeavePolicy from "../models/LeavePolicy.js";
import LeaveBalance from "../models/LeaveBalance.js";
import PositionHistory from "../models/PositionHistory.js";
import EmployeeShift from "../models/EmployeeShift.js";
import { uploadToCloudinary } from "../config/cloudinaryConfig.js";
import mongoose from "mongoose";

// Helper function to generate employee ID
const generateEmployeeId = async () => {
  const lastEmployee = await Employee.findOne()
    .sort({ createdAt: -1 })
    .select("employeeID");

  if (!lastEmployee || !lastEmployee.employeeID) {
    return "TAJ-0001";
  }

  const lastNumber = parseInt(lastEmployee.employeeID.split("-")[1], 10);
  const newNumber = (lastNumber + 1).toString().padStart(4, "0");
  return `TAJ-${newNumber}`;
};

// Helper function to create or update leave balances for an employee
const createLeaveBalances = async (employeeId, positionId) => {
  const position = await Position.findById(positionId).populate({
    path: "leavePolicy",
    populate: {
      path: "entitlements.leaveType",
      select: "_id name",
    },
  });

  if (!position || !position.leavePolicy) {
    throw new Error("Position does not have a leave policy assigned");
  }

  const currentYear = new Date().getFullYear();
  const leaveBalances = [];

  for (const entitlement of position.leavePolicy.entitlements) {
    const existingBalance = await LeaveBalance.findOne({
      employee: employeeId,
      leaveType: entitlement.leaveType._id,
      year: currentYear,
    });

    if (existingBalance) {
      existingBalance.totalDays = entitlement.days;
      existingBalance.remainingDays = Math.max(
        0,
        existingBalance.totalDays - existingBalance.usedDays,
      );
      await existingBalance.save();
      leaveBalances.push(existingBalance);
    } else {
      const newBalance = await LeaveBalance.create({
        employee: employeeId,
        leaveType: entitlement.leaveType._id,
        totalDays: entitlement.days,
        usedDays: 0,
        remainingDays: entitlement.days,
        year: currentYear,
      });
      leaveBalances.push(newBalance);
    }
  }

  return leaveBalances;
};

// @description     Create new employee
// @route           POST /api/employees
// @access          Admin
export const createEmployee = async (req, res, next) => {
  try {
    const {
      position,
      basicSalary,
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

    // Validate position ID
    if (!mongoose.Types.ObjectId.isValid(position)) {
      res.status(400);
      throw new Error("Invalid position ID");
    }

    // Check if position exists and get leave policy
    const positionDoc =
      await Position.findById(position).populate("leavePolicy");
    if (!positionDoc) {
      res.status(404);
      throw new Error("Position not found");
    }

    // Check employee limit for position
    const employeeLimitStr = positionDoc.employeeLimit?.trim().toLowerCase();
    if (employeeLimitStr && employeeLimitStr !== "unlimited") {
      const limit = parseInt(employeeLimitStr, 10);
      if (!isNaN(limit) && positionDoc.hiredEmployees >= limit) {
        res.status(400);
        throw new Error(
          `Employee limit reached for ${positionDoc.name} position. Maximum employees allowed: ${limit}`,
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

    // Handle CNIC image uploads
    let cnicImages = { front: null, back: null };

    if (req.files) {
      try {
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
      } catch (uploadError) {
        res.status(500);
        throw new Error(`Failed to upload CNIC images: ${uploadError.message}`);
      }
    }

    // Parse JSON fields if they come as strings
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

    // Create employee
    const newEmployee = new Employee({
      employeeID,
      position,
      basicSalary: basicSalary ? Number(basicSalary) : 0,
      status: "Active",
      fullName: fullName.trim(),
      gender,
      fatherName: fatherName?.trim() || "",
      husbandName: husbandName?.trim() || "",
      joiningDate: joiningDate || new Date(),
      cnic: cnic?.trim() || "",
      cnicImages,
      dob: dob || null,
      contactNumber: contactNumber?.trim() || "",
      province: province?.trim() || "",
      city: city?.trim() || "",
      maritalStatus: maritalStatus || "Single",
      currentStreetAddress: currentStreetAddress?.trim() || "",
      permanentStreetAddress: permanentStreetAddress?.trim() || "",
      emergencyContact: parseIfString(emergencyContact) || [],
      medical: parseIfString(medical) || {},
      education: parseIfString(education) || [],
      previousExperience: parseIfString(previousExperience) || [],
      guarantor: parseIfString(guarantor) || [],
      legal: parseIfString(legal) || {},
    });

    const savedEmployee = await newEmployee.save();

    // Increment hired employees count in position
    await Position.findByIdAndUpdate(position, { $inc: { hiredEmployees: 1 } });

    // Increment employee count in department
    await Department.findByIdAndUpdate(positionDoc.department, {
      $inc: { employeeCount: 1 },
    });

    // Create leave balances based on position's leave policy
    let leaveBalances = [];
    try {
      if (positionDoc.leavePolicy) {
        leaveBalances = await createLeaveBalances(savedEmployee._id, position);
      }
    } catch (leaveError) {
      console.error("Error creating leave balances:", leaveError.message);
      // Don't fail the whole request if leave balance creation fails
    }

    // Create initial position history record
    await PositionHistory.create({
      employee: savedEmployee._id,
      fromPosition: null,
      toPosition: position,
      changedBy: req.user._id,
      reason: "Initial assignment on employee creation",
    });

    // Populate references for response
    const populatedEmployee = await Employee.findById(savedEmployee._id)
      .populate({
        path: "position",
        select: "name department allowancePolicy",
        populate: [
          { path: "department", select: "name" },
          { path: "allowancePolicy", select: "name" },
        ],
      });

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
// @access          Admin
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
        select: "name department allowancePolicy",
        populate: [
          { path: "department", select: "name" },
          { path: "allowancePolicy", select: "name" },
        ],
      })
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
        select: "name department leavePolicy allowancePolicy",
        populate: [
          { path: "department", select: "name" },
          { path: "leavePolicy", select: "name" },
          {
            path: "allowancePolicy",
            select: "name components",
            populate: {
              path: "components.allowanceComponent",
              select: "name",
            },
          },
        ],
      });

    if (!employee) {
      res.status(404);
      throw new Error("Employee Not Found");
    }

    // Get leave balances
    const leaveBalances = await LeaveBalance.find({ employee: id })
      .populate("leaveType", "name isPaid")
      .sort({ year: -1 });

    res.json({
      employee,
      leaveBalances,
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
      legal,
      position,
      basicSalary,
      employmentType,
    } = req.body;

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

    // Handle CNIC image uploads
    if (req.files) {
      try {
        if (req.files.cnicFront && req.files.cnicFront[0]) {
          const frontResult = await uploadToCloudinary(
            req.files.cnicFront[0].buffer,
            `taj-hrms/employees/${employee.employeeID}/cnic`,
            "front",
          );
          employee.cnicImages.front = frontResult.secure_url;
        }

        if (req.files.cnicBack && req.files.cnicBack[0]) {
          const backResult = await uploadToCloudinary(
            req.files.cnicBack[0].buffer,
            `taj-hrms/employees/${employee.employeeID}/cnic`,
            "back",
          );
          employee.cnicImages.back = backResult.secure_url;
        }
      } catch (uploadError) {
        res.status(500);
        throw new Error(`Failed to upload CNIC images: ${uploadError.message}`);
      }
    }

    // Parse JSON fields if they come as strings
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

    // Track changes for response
    let positionChanged = false;
    let leaveBalanceChanges = [];

    // Handle position change
    if (position && position !== employee.position?.toString()) {
      if (!mongoose.Types.ObjectId.isValid(position)) {
        res.status(400);
        throw new Error("Invalid position ID");
      }

      // Get old position with leave policy
      const oldPositionDoc = await Position.findById(
        employee.position,
      ).populate({
        path: "leavePolicy",
        populate: {
          path: "entitlements.leaveType",
          select: "_id name",
        },
      });

      // Get new position with leave policy
      const newPositionDoc = await Position.findById(position).populate({
        path: "leavePolicy",
        populate: {
          path: "entitlements.leaveType",
          select: "_id name",
        },
      });

      if (!newPositionDoc) {
        res.status(404);
        throw new Error("Position not found");
      }

      // Check employee limit for new position
      const employeeLimitStr = newPositionDoc.employeeLimit
        ?.trim()
        .toLowerCase();
      if (employeeLimitStr && employeeLimitStr !== "unlimited") {
        const limit = parseInt(employeeLimitStr, 10);
        if (!isNaN(limit) && newPositionDoc.hiredEmployees >= limit) {
          res.status(400);
          throw new Error(
            `Employee limit reached for ${newPositionDoc.name} position. Maximum employees allowed: ${limit}`,
          );
        }
      }

      const fromPosition = employee.position;
      const effectiveDate = new Date();
      const currentYear = effectiveDate.getFullYear();

      // Create position history record
      await PositionHistory.create({
        employee: id,
        fromPosition,
        toPosition: position,
        changedBy: req.user._id,
        effectiveDate,
        reason: "Updated via employee edit form",
      });

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

      // Handle leave balance adjustments if leave policy changes
      const oldLeavePolicyId = oldPositionDoc?.leavePolicy?._id?.toString();
      const newLeavePolicyId = newPositionDoc?.leavePolicy?._id?.toString();

      if (oldLeavePolicyId !== newLeavePolicyId && newPositionDoc.leavePolicy) {
        // Calculate remaining days in the year from effective date
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31);
        const totalDaysInYear =
          Math.ceil((endOfYear - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
        const daysRemainingInYear =
          Math.ceil((endOfYear - effectiveDate) / (1000 * 60 * 60 * 24)) + 1;
        const prorationFactor = daysRemainingInYear / totalDaysInYear;

        // Get current leave balances for this employee and year
        const currentBalances = await LeaveBalance.find({
          employee: id,
          year: currentYear,
        });

        const currentBalancesMap = new Map();
        for (const balance of currentBalances) {
          currentBalancesMap.set(balance.leaveType.toString(), balance);
        }

        // Process new leave policy entitlements
        for (const entitlement of newPositionDoc.leavePolicy.entitlements) {
          const leaveTypeId = entitlement.leaveType._id.toString();
          const existingBalance = currentBalancesMap.get(leaveTypeId);

          if (existingBalance) {
            // Leave type exists in both policies
            const oldEntitlement =
              oldPositionDoc?.leavePolicy?.entitlements?.find(
                (e) => e.leaveType._id.toString() === leaveTypeId,
              );
            const oldTotalDays = oldEntitlement?.days || 0;
            const newTotalDays = entitlement.days;

            if (newTotalDays > oldTotalDays) {
              // More leaves in new policy - add prorated difference to remaining
              const additionalDays = Math.round(
                (newTotalDays - oldTotalDays) * prorationFactor,
              );
              existingBalance.totalDays = oldTotalDays + additionalDays;
              existingBalance.remainingDays = Math.max(
                0,
                existingBalance.totalDays - existingBalance.usedDays,
              );
              await existingBalance.save();
              leaveBalanceChanges.push({
                leaveType: entitlement.leaveType.name,
                action: "increased",
                oldTotal: oldTotalDays,
                newTotal: existingBalance.totalDays,
                additionalDays,
              });
            } else if (newTotalDays < oldTotalDays) {
              // Fewer leaves in new policy - reduce total but don't affect used days
              const newProratedTotal =
                Math.round(newTotalDays * prorationFactor) +
                existingBalance.usedDays;
              existingBalance.totalDays = Math.max(
                existingBalance.usedDays,
                newProratedTotal,
              );
              existingBalance.remainingDays = Math.max(
                0,
                existingBalance.totalDays - existingBalance.usedDays,
              );
              await existingBalance.save();
              leaveBalanceChanges.push({
                leaveType: entitlement.leaveType.name,
                action: "adjusted",
                oldTotal: oldTotalDays,
                newTotal: existingBalance.totalDays,
              });
            }
            // Remove from map to track processed leave types
            currentBalancesMap.delete(leaveTypeId);
          } else {
            // New leave type - create prorated balance
            const proratedDays = Math.round(entitlement.days * prorationFactor);
            await LeaveBalance.create({
              employee: id,
              leaveType: entitlement.leaveType._id,
              totalDays: proratedDays,
              usedDays: 0,
              remainingDays: proratedDays,
              year: currentYear,
            });
            leaveBalanceChanges.push({
              leaveType: entitlement.leaveType.name,
              action: "created",
              totalDays: proratedDays,
              note: `Prorated for ${daysRemainingInYear} remaining days in year`,
            });
          }
        }
      }

      employee.position = position;
      positionChanged = true;
    }

    // Handle basic salary change
    if (basicSalary !== undefined) {
      employee.basicSalary = Number(basicSalary) || 0;
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
      employee.husbandName = husbandName?.trim() || "";
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
      employee.emergencyContact = parseIfString(emergencyContact) || [];
    if (medical !== undefined) employee.medical = parseIfString(medical) || {};
    if (education !== undefined)
      employee.education = parseIfString(education) || [];
    if (previousExperience !== undefined)
      employee.previousExperience = parseIfString(previousExperience) || [];
    if (guarantor !== undefined)
      employee.guarantor = parseIfString(guarantor) || [];
    if (legal !== undefined) employee.legal = parseIfString(legal) || {};

    const updatedEmployee = await employee.save();

    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate({
        path: "position",
        select: "name department allowancePolicy",
        populate: [
          { path: "department", select: "name" },
          { path: "allowancePolicy", select: "name" },
        ],
      });

    res.json({
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

    // Get old position with leave policy
    const oldPositionDoc = await Position.findById(employee.position).populate({
      path: "leavePolicy",
      populate: {
        path: "entitlements.leaveType",
        select: "_id name",
      },
    });

    // Get new position with leave policy
    const newPositionDoc = await Position.findById(newPosition).populate({
      path: "leavePolicy",
      populate: {
        path: "entitlements.leaveType",
        select: "_id name",
      },
    });

    if (!newPositionDoc) {
      res.status(404);
      throw new Error("Position not found");
    }

    // Check employee limit for new position
    const employeeLimitStr = newPositionDoc.employeeLimit?.trim().toLowerCase();
    if (employeeLimitStr && employeeLimitStr !== "unlimited") {
      const limit = parseInt(employeeLimitStr, 10);
      if (!isNaN(limit) && newPositionDoc.hiredEmployees >= limit) {
        res.status(400);
        throw new Error(
          `Employee limit reached for ${newPositionDoc.name} position. Maximum employees allowed: ${limit}`,
        );
      }
    }

    const fromPosition = employee.position;
    const parsedEffectiveDate = effectiveDate
      ? new Date(effectiveDate)
      : new Date();
    const currentYear = parsedEffectiveDate.getFullYear();

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

    // Handle leave balance adjustments if leave policy changes
    let leaveBalanceChanges = [];
    const oldLeavePolicyId = oldPositionDoc?.leavePolicy?._id?.toString();
    const newLeavePolicyId = newPositionDoc?.leavePolicy?._id?.toString();

    if (oldLeavePolicyId !== newLeavePolicyId && newPositionDoc.leavePolicy) {
      // Calculate remaining days in the year from effective date
      const startOfYear = new Date(currentYear, 0, 1);
      const endOfYear = new Date(currentYear, 11, 31);
      const totalDaysInYear =
        Math.ceil((endOfYear - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
      const daysRemainingInYear =
        Math.ceil((endOfYear - parsedEffectiveDate) / (1000 * 60 * 60 * 24)) +
        1;
      const prorationFactor = daysRemainingInYear / totalDaysInYear;

      // Get current leave balances for this employee and year
      const currentBalances = await LeaveBalance.find({
        employee: id,
        year: currentYear,
      });

      const currentBalancesMap = new Map();
      for (const balance of currentBalances) {
        currentBalancesMap.set(balance.leaveType.toString(), balance);
      }

      // Process new leave policy entitlements
      for (const entitlement of newPositionDoc.leavePolicy.entitlements) {
        const leaveTypeId = entitlement.leaveType._id.toString();
        const existingBalance = currentBalancesMap.get(leaveTypeId);

        if (existingBalance) {
          // Leave type exists in both policies
          const oldEntitlement =
            oldPositionDoc?.leavePolicy?.entitlements?.find(
              (e) => e.leaveType._id.toString() === leaveTypeId,
            );
          const oldTotalDays = oldEntitlement?.days || 0;
          const newTotalDays = entitlement.days;

          if (newTotalDays > oldTotalDays) {
            // More leaves in new policy - add prorated difference to remaining
            const additionalDays = Math.round(
              (newTotalDays - oldTotalDays) * prorationFactor,
            );
            existingBalance.totalDays = oldTotalDays + additionalDays;
            existingBalance.remainingDays = Math.max(
              0,
              existingBalance.totalDays - existingBalance.usedDays,
            );
            await existingBalance.save();
            leaveBalanceChanges.push({
              leaveType: entitlement.leaveType.name,
              action: "increased",
              oldTotal: oldTotalDays,
              newTotal: existingBalance.totalDays,
              additionalDays,
            });
          } else if (newTotalDays < oldTotalDays) {
            // Fewer leaves in new policy - reduce total but don't affect used days
            const newProratedTotal =
              Math.round(newTotalDays * prorationFactor) +
              existingBalance.usedDays;
            existingBalance.totalDays = Math.max(
              existingBalance.usedDays,
              newProratedTotal,
            );
            existingBalance.remainingDays = Math.max(
              0,
              existingBalance.totalDays - existingBalance.usedDays,
            );
            await existingBalance.save();
            leaveBalanceChanges.push({
              leaveType: entitlement.leaveType.name,
              action: "adjusted",
              oldTotal: oldTotalDays,
              newTotal: existingBalance.totalDays,
            });
          }
          // Remove from map to track processed leave types
          currentBalancesMap.delete(leaveTypeId);
        } else {
          // New leave type - create prorated balance
          const proratedDays = Math.round(entitlement.days * prorationFactor);
          await LeaveBalance.create({
            employee: id,
            leaveType: entitlement.leaveType._id,
            totalDays: proratedDays,
            usedDays: 0,
            remainingDays: proratedDays,
            year: currentYear,
          });
          leaveBalanceChanges.push({
            leaveType: entitlement.leaveType.name,
            action: "created",
            totalDays: proratedDays,
            note: `Prorated for ${daysRemainingInYear} remaining days in year`,
          });
        }
      }

      // Leave types no longer in new policy - keep them but mark as frozen (no new accrual)
      // We don't delete used balances as employee may have already used some leaves
    }

    // Update employee
    employee.position = newPosition;
    const updatedEmployee = await employee.save();

    const populatedEmployee = await Employee.findById(updatedEmployee._id)
      .populate({
        path: "position",
        select: "name department allowancePolicy",
        populate: [
          { path: "department", select: "name" },
          { path: "allowancePolicy", select: "name" },
        ],
      });

    res.json({
      message: "Employee position changed successfully",
      employee: populatedEmployee,
      leaveBalanceChanges,
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

// @description     Get employees list (for dropdowns)
// @route           GET /api/employees/list
// @access          Admin
export const getEmployeesList = async (req, res, next) => {
  try {
    const employees = await Employee.find({ status: "Active" })
      .select("_id fullName employeeID position")
      .populate("position", "name")
      .sort({ fullName: 1 });

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

    const employee = await Employee.findById(id).populate({
      path: "position",
      populate: {
        path: "leavePolicy",
        populate: {
          path: "entitlements.leaveType",
          select: "_id name",
        },
      },
    });

    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (!employee.position?.leavePolicy) {
      res.status(400);
      throw new Error(
        "Employee's position does not have a leave policy assigned",
      );
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

    // Create new leave balances based on current position's leave policy
    const newBalances = [];
    for (const entitlement of employee.position.leavePolicy.entitlements) {
      const balance = await LeaveBalance.create({
        employee: id,
        leaveType: entitlement.leaveType._id,
        totalDays: entitlement.days,
        usedDays: 0,
        remainingDays: entitlement.days,
        year: targetYear,
      });
      newBalances.push({
        leaveType: entitlement.leaveType.name,
        totalDays: entitlement.days,
      });
    }

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

    // Get all active employees with their positions and leave policies
    const employees = await Employee.find({ status: "Active" }).populate({
      path: "position",
      populate: {
        path: "leavePolicy",
        populate: {
          path: "entitlements.leaveType",
          select: "_id name",
        },
      },
    });

    const results = {
      success: [],
      skipped: [],
      errors: [],
    };

    for (const employee of employees) {
      try {
        if (!employee.position?.leavePolicy) {
          results.skipped.push({
            employeeID: employee.employeeID,
            fullName: employee.fullName,
            reason: "No leave policy assigned to position",
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

        // Create new leave balances
        const balancesToCreate = employee.position.leavePolicy.entitlements.map(
          (entitlement) => ({
            employee: employee._id,
            leaveType: entitlement.leaveType._id,
            totalDays: entitlement.days,
            usedDays: 0,
            remainingDays: entitlement.days,
            year: targetYear,
          }),
        );

        await LeaveBalance.insertMany(balancesToCreate);

        results.success.push({
          employeeID: employee.employeeID,
          fullName: employee.fullName,
          balancesCreated: balancesToCreate.length,
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
