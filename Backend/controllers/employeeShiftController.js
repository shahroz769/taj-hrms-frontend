import EmployeeShift from "../models/EmployeeShift.js";
import Employee from "../models/Employee.js";
import Shift from "../models/Shift.js";
import mongoose from "mongoose";

// @description     Assign shift to multiple employees
// @route           POST /api/employee-shifts/assign
// @access          Admin
export const assignShiftToEmployees = async (req, res, next) => {
  try {
    const { employeeIds, shiftId, effectiveDate } = req.body;

    // Validate required fields
    if (
      !employeeIds ||
      !Array.isArray(employeeIds) ||
      employeeIds.length === 0
    ) {
      res.status(400);
      throw new Error("At least one employee ID is required");
    }

    if (!shiftId) {
      res.status(400);
      throw new Error("Shift ID is required");
    }

    if (!effectiveDate) {
      res.status(400);
      throw new Error("Effective date is required");
    }

    // Validate shift ID
    if (!mongoose.Types.ObjectId.isValid(shiftId)) {
      res.status(400);
      throw new Error("Invalid shift ID");
    }

    // Check if shift exists and is approved
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status !== "Approved") {
      res.status(400);
      throw new Error("Cannot assign a shift that is not approved");
    }

    // Validate all employee IDs
    const invalidIds = employeeIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );
    if (invalidIds.length > 0) {
      res.status(400);
      throw new Error(`Invalid employee ID(s): ${invalidIds.join(", ")}`);
    }

    // Check all employees exist
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    if (employees.length !== employeeIds.length) {
      const foundIds = employees.map((e) => e._id.toString());
      const notFoundIds = employeeIds.filter((id) => !foundIds.includes(id));
      res.status(404);
      throw new Error(`Employee(s) not found: ${notFoundIds.join(", ")}`);
    }

    const parsedEffectiveDate = new Date(effectiveDate);
    parsedEffectiveDate.setHours(0, 0, 0, 0); // Normalize to start of day

    // Calculate end date for previous shifts (one day before new effective date)
    const previousEndDate = new Date(parsedEffectiveDate);
    previousEndDate.setDate(previousEndDate.getDate() - 1);
    previousEndDate.setHours(23, 59, 59, 999);

    const assignments = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      try {
        // Find current active shift for this employee (endDate is null)
        const currentShift = await EmployeeShift.findOne({
          employee: employeeId,
          endDate: null,
        });

        // If there's an active shift, close it
        if (currentShift) {
          // Check if new effective date is after current shift's effective date
          if (parsedEffectiveDate <= currentShift.effectiveDate) {
            errors.push({
              employeeId,
              error:
                "New effective date must be after current shift's effective date",
            });
            continue;
          }
          currentShift.endDate = previousEndDate;
          await currentShift.save();
        }

        // Create new shift assignment
        const newAssignment = new EmployeeShift({
          employee: employeeId,
          shift: shiftId,
          effectiveDate: parsedEffectiveDate,
          endDate: null,
          assignedBy: req.user._id,
        });

        const savedAssignment = await newAssignment.save();
        assignments.push({
          employee: employeeId,
          shift: shiftId,
          effectiveDate: parsedEffectiveDate,
          assignmentId: savedAssignment._id,
        });
      } catch (err) {
        errors.push({
          employeeId,
          error: err.message,
        });
      }
    }

    if (assignments.length === 0) {
      res.status(400);
      throw new Error(
        "No shifts were assigned. Errors: " + JSON.stringify(errors),
      );
    }

    res.status(201).json({
      message: `Shift assigned successfully to ${assignments.length} employee(s)`,
      assignments,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get current shift for an employee
// @route           GET /api/employee-shifts/employee/:id/current
// @access          Admin
export const getEmployeeCurrentShift = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    // Check if employee exists
    const employee = await Employee.findById(id).select("fullName employeeID");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    // Find current active shift (endDate is null)
    const currentShiftAssignment = await EmployeeShift.findOne({
      employee: id,
      endDate: null,
    }).populate("shift", "name startTime endTime workingDays");

    res.json({
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      currentShift: currentShiftAssignment
        ? {
            assignment: currentShiftAssignment._id,
            shift: currentShiftAssignment.shift,
            effectiveDate: currentShiftAssignment.effectiveDate,
          }
        : null,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get shift history for an employee
// @route           GET /api/employee-shifts/employee/:id/history
// @access          Admin
export const getEmployeeShiftHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    // Check if employee exists
    const employee = await Employee.findById(id).select("fullName employeeID");
    if (!employee) {
      res.status(404);
      throw new Error("Employee not found");
    }

    // Get all shift assignments for this employee, sorted by effective date descending
    const shiftHistory = await EmployeeShift.find({ employee: id })
      .populate("shift", "name startTime endTime workingDays")
      .populate("assignedBy", "name")
      .sort({ effectiveDate: -1 });

    res.json({
      employee: {
        _id: employee._id,
        fullName: employee.fullName,
        employeeID: employee.employeeID,
      },
      shiftHistory,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get all employees on a specific shift
// @route           GET /api/employee-shifts/shift/:id/employees
// @access          Admin
export const getEmployeesByShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeInactive } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400);
      throw new Error("Invalid shift ID");
    }

    // Check if shift exists
    const shift = await Shift.findById(id);
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    // Build query for current active assignments
    const query = { shift: id };
    if (!includeInactive || includeInactive !== "true") {
      query.endDate = null; // Only include currently active assignments
    }

    const assignments = await EmployeeShift.find(query)
      .populate({
        path: "employee",
        select: "fullName employeeID status position",
        populate: {
          path: "position",
          select: "name",
        },
      })
      .sort({ effectiveDate: -1 });

    res.json({
      shift: {
        _id: shift._id,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
      },
      totalEmployees: assignments.length,
      employees: assignments.map((a) => ({
        employee: a.employee,
        effectiveDate: a.effectiveDate,
        endDate: a.endDate,
      })),
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get shifts list for dropdown
// @route           GET /api/employee-shifts/shifts-list
// @access          Admin
export const getShiftsList = async (req, res, next) => {
  try {
    const shifts = await Shift.find({ status: "Approved" })
      .select("name startTime endTime")
      .sort({ name: 1 });

    res.json({ shifts });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
