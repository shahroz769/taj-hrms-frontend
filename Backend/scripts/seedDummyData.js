import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import Department from "../models/Department.js";
import Position from "../models/Position.js";
import Shift from "../models/Shift.js";
import LeaveType from "../models/LeaveType.js";
import LeavePolicy from "../models/LeavePolicy.js";
import Employee from "../models/Employee.js";
import EmployeeShift from "../models/EmployeeShift.js";
import LeaveBalance from "../models/LeaveBalance.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Attendance from "../models/Attendance.js";
import MonthlyAttendanceSummary from "../models/MonthlyAttendanceSummary.js";
import Payroll from "../models/Payroll.js";
import Deduction from "../models/Deduction.js";
import DisciplinaryAction from "../models/DisciplinaryAction.js";
import WarningType from "../models/WarningType.js";
import WorkProgressReport from "../models/WorkProgressReport.js";
import User from "../models/User.js";
import Contract from "../models/Contract.js";
import ContractAttendance from "../models/ContractAttendance.js";
import ContractPayment from "../models/ContractPayment.js";
import AllowanceComponent from "../models/AllowanceComponent.js";
import AllowancePolicy from "../models/AllowancePolicy.js";
import AllowancePolicyHistory from "../models/AllowancePolicyHistory.js";
import AllowancePolicyAmountHistory from "../models/AllowancePolicyAmountHistory.js";
import BasicSalaryHistory from "../models/BasicSalaryHistory.js";
import PositionHistory from "../models/PositionHistory.js";
import PayrollArrearsLedger from "../models/PayrollArrearsLedger.js";
import {
  calculateEmployeePayroll,
  settleArrearsForPayroll,
} from "../services/payrollService.js";

const MARKER = "Seed 2026";
const EMPLOYEE_PREFIX = "SEED26-";
const START_DATE = new Date(Date.UTC(2026, 0, 1));
const END_DATE = new Date(Date.UTC(2026, 2, 16));
const PAYROLL_MONTHS = [1, 2];

const FIRST_NAMES = [
  "Ali", "Ahmed", "Umar", "Hassan", "Bilal", "Zain", "Ahsan", "Kamran",
  "Sajid", "Usman", "Hamza", "Yasir", "Danish", "Farhan", "Imran", "Saad",
  "Owais", "Rizwan", "Shahzaib", "Tariq", "Areeba", "Fatima", "Ayesha",
  "Hina", "Iqra", "Maham", "Nida", "Sana", "Zara", "Noor",
];

const LAST_NAMES = [
  "Khan", "Ahmed", "Malik", "Shaikh", "Qureshi", "Farooq", "Siddiqui",
  "Memon", "Butt", "Raza", "Mirza", "Ansari", "Nawaz", "Tahir", "Javed",
];

const WORKING_DAYS = {
  standard: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  office: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  support: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
};

const utcDate = (year, monthIndex, day, hour = 0, minute = 0) =>
  new Date(Date.UTC(year, monthIndex, day, hour, minute, 0, 0));

const cloneDate = (date) => new Date(date.getTime());

const addDays = (date, days) => {
  const next = cloneDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const atUtcMidnight = (date) =>
  utcDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const formatDate = (date) => date.toISOString().split("T")[0];

const enumerateDates = (start, end) => {
  const dates = [];
  let cursor = atUtcMidnight(start);
  const last = atUtcMidnight(end);
  while (cursor <= last) {
    dates.push(cloneDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
};

const dayName = (date) =>
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    date.getUTCDay()
  ];

const buildDateTime = (date, timeStr) => {
  const [hour, minute] = String(timeStr).split(":").map(Number);
  return utcDate(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hour,
    minute,
  );
};

const pick = (items, index) => items[index % items.length];

const getLeaveDatesFromRanges = (ranges) =>
  ranges.flatMap((range) => enumerateDates(range.startDate, range.endDate));

const getShiftForDate = (assignments, targetDate) => {
  for (let index = assignments.length - 1; index >= 0; index -= 1) {
    const assignment = assignments[index];
    if (
      assignment.effectiveDate <= targetDate &&
      (!assignment.endDate || assignment.endDate >= targetDate)
    ) {
      return assignment.shift;
    }
  }
  return null;
};

const buildMonthlySummaryDocs = (attendanceDocs) => {
  const map = new Map();

  for (const doc of attendanceDocs) {
    const date = new Date(doc.date);
    const key = [
      doc.employee.toString(),
      date.getUTCFullYear(),
      date.getUTCMonth(),
    ].join("__");

    if (!map.has(key)) {
      map.set(key, {
        employee: doc.employee,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth(),
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        off: 0,
        leave: 0,
        totalWorkingDays: 0,
      });
    }

    const summary = map.get(key);
    if (doc.status === "Present") {
      summary.present += 1;
      summary.totalWorkingDays += 1;
    } else if (doc.status === "Absent") {
      summary.absent += 1;
    } else if (doc.status === "Late") {
      summary.late += 1;
      summary.totalWorkingDays += 1;
    } else if (doc.status === "Half Day") {
      summary.halfDay += 1;
      summary.totalWorkingDays += 1;
    } else if (doc.status === "Off") {
      summary.off += 1;
    } else if (doc.status === "Leave") {
      summary.leave += 1;
    }
  }

  return [...map.values()];
};

const payrollSnapshotEmployee = async (employeeId) =>
  Employee.findById(employeeId)
    .populate({
      path: "position",
      select: "name department",
      populate: { path: "department", select: "name" },
    })
    .populate({
      path: "allowancePolicy",
      populate: { path: "components.allowanceComponent", select: "name" },
    });

const cleanupSeedData = async () => {
  const employeeIds = await Employee.find({
    employeeID: { $regex: `^${EMPLOYEE_PREFIX}` },
  }).distinct("_id");
  const contractIds = await Contract.find({
    contractName: { $regex: MARKER, $options: "i" },
  }).distinct("_id");
  const allowancePolicyIds = await AllowancePolicy.find({
    name: { $regex: MARKER, $options: "i" },
  }).distinct("_id");

  await Payroll.deleteMany({ employee: { $in: employeeIds } });
  await PayrollArrearsLedger.deleteMany({ employee: { $in: employeeIds } });
  await MonthlyAttendanceSummary.deleteMany({ employee: { $in: employeeIds } });
  await Attendance.deleteMany({ employee: { $in: employeeIds } });
  await LeaveApplication.deleteMany({ employee: { $in: employeeIds } });
  await LeaveBalance.deleteMany({ employee: { $in: employeeIds } });
  await EmployeeShift.deleteMany({ employee: { $in: employeeIds } });
  await Deduction.deleteMany({ employee: { $in: employeeIds } });
  await DisciplinaryAction.deleteMany({ employee: { $in: employeeIds } });
  await WorkProgressReport.deleteMany({
    $or: [
      { taskDescription: { $regex: MARKER, $options: "i" } },
      { employees: { $in: employeeIds } },
    ],
  });
  await PositionHistory.deleteMany({ employee: { $in: employeeIds } });
  await BasicSalaryHistory.deleteMany({ employee: { $in: employeeIds } });
  await AllowancePolicyHistory.deleteMany({ employee: { $in: employeeIds } });

  await ContractAttendance.deleteMany({ contractId: { $in: contractIds } });
  await ContractPayment.deleteMany({ contractId: { $in: contractIds } });
  await Contract.deleteMany({ _id: { $in: contractIds } });

  await Employee.deleteMany({ _id: { $in: employeeIds } });
  await WarningType.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await Shift.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await Position.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await Department.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await LeavePolicy.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await LeaveType.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await AllowancePolicyAmountHistory.deleteMany({
    allowancePolicy: { $in: allowancePolicyIds },
  });
  await AllowancePolicy.deleteMany({ _id: { $in: allowancePolicyIds } });
  await AllowanceComponent.deleteMany({ name: { $regex: MARKER, $options: "i" } });
  await User.deleteMany({ username: { $regex: "^seed26-" } });
};

const createUsers = async () => {
  const admin = new User({
    name: `${MARKER} Admin`,
    username: "seed26-admin",
    password: "seed1234",
    role: "admin",
  });
  const supervisor = new User({
    name: `${MARKER} Supervisor`,
    username: "seed26-supervisor",
    password: "seed1234",
    role: "supervisor",
  });
  await admin.save();
  await supervisor.save();
  return { admin, supervisor };
};

const createBaseSetup = async (admin) => {
  const allowanceComponents = await AllowanceComponent.insertMany([
    { name: `${MARKER} House Rent`, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Medical`, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Utility`, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Transport`, status: "Approved", createdBy: "seed-script" },
  ]);

  const [houseRent, medical, utility, transport] = allowanceComponents;
  const allowancePolicies = await AllowancePolicy.insertMany([
    {
      name: `${MARKER} Operations Package`,
      components: [
        { allowanceComponent: houseRent._id, amount: 6000 },
        { allowanceComponent: medical._id, amount: 2500 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Office Package`,
      components: [
        { allowanceComponent: houseRent._id, amount: 8000 },
        { allowanceComponent: medical._id, amount: 3000 },
        { allowanceComponent: utility._id, amount: 2000 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Leadership Package`,
      components: [
        { allowanceComponent: houseRent._id, amount: 12000 },
        { allowanceComponent: medical._id, amount: 5000 },
        { allowanceComponent: utility._id, amount: 3000 },
        { allowanceComponent: transport._id, amount: 4000 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
  ]);

  const leaveTypes = await LeaveType.insertMany([
    { name: `${MARKER} Casual Leave`, isPaid: true, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Sick Leave`, isPaid: true, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Annual Leave`, isPaid: true, status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Unpaid Leave`, isPaid: false, status: "Approved", createdBy: "seed-script" },
  ]);

  const [casual, sick, annual, unpaid] = leaveTypes;
  const leavePolicies = await LeavePolicy.insertMany([
    {
      name: `${MARKER} Staff Leave Policy`,
      entitlements: [
        { leaveType: casual._id, days: 8 },
        { leaveType: sick._id, days: 10 },
        { leaveType: annual._id, days: 12 },
        { leaveType: unpaid._id, days: 30 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Management Leave Policy`,
      entitlements: [
        { leaveType: casual._id, days: 10 },
        { leaveType: sick._id, days: 12 },
        { leaveType: annual._id, days: 18 },
        { leaveType: unpaid._id, days: 30 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Support Leave Policy`,
      entitlements: [
        { leaveType: casual._id, days: 6 },
        { leaveType: sick._id, days: 8 },
        { leaveType: annual._id, days: 10 },
        { leaveType: unpaid._id, days: 25 },
      ],
      status: "Approved",
      createdBy: "seed-script",
    },
  ]);

  const departmentSpecs = [
    ["Human Resources", [["HR Executive", "12", leavePolicies[0]._id], ["HR Manager", "4", leavePolicies[1]._id]]],
    ["Finance", [["Accounts Officer", "10", leavePolicies[0]._id], ["Finance Manager", "3", leavePolicies[1]._id]]],
    ["Operations", [["Operations Coordinator", "12", leavePolicies[0]._id], ["Operations Manager", "4", leavePolicies[1]._id]]],
    ["IT", [["Software Support Engineer", "10", leavePolicies[2]._id], ["IT Manager", "3", leavePolicies[1]._id]]],
    ["Procurement", [["Procurement Officer", "8", leavePolicies[0]._id], ["Procurement Manager", "3", leavePolicies[1]._id]]],
    ["Administration", [["Admin Officer", "8", leavePolicies[2]._id], ["Admin Manager", "3", leavePolicies[1]._id]]],
  ];

  const positions = [];
  for (const [deptName, positionSpecs] of departmentSpecs) {
    const department = await Department.create({
      name: `${MARKER} ${deptName}`,
      positionCount: String(positionSpecs.length),
      employeeCount: 0,
      isActive: true,
      createdBy: admin._id,
    });

    const createdPositions = await Position.insertMany(
      positionSpecs.map(([name, limit, leavePolicy]) => ({
        name: `${MARKER} ${name}`,
        department: department._id,
        reportsTo: "Management",
        leavePolicy,
        employeeLimit: limit,
        hiredEmployees: 0,
      })),
    );
    positions.push(...createdPositions);
  }

  const shifts = await Shift.insertMany([
    {
      name: `${MARKER} Day Shift`,
      startTime: "09:00",
      endTime: "17:00",
      workingDays: WORKING_DAYS.standard,
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Office Shift`,
      startTime: "10:00",
      endTime: "18:00",
      workingDays: WORKING_DAYS.office,
      status: "Approved",
      createdBy: "seed-script",
    },
    {
      name: `${MARKER} Support Shift`,
      startTime: "08:00",
      endTime: "16:00",
      workingDays: WORKING_DAYS.support,
      status: "Approved",
      createdBy: "seed-script",
    },
  ]);

  const warningTypes = await WarningType.insertMany([
    { name: `${MARKER} Attendance Violation`, severity: "Low", status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Conduct Issue`, severity: "Medium", status: "Approved", createdBy: "seed-script" },
    { name: `${MARKER} Compliance Breach`, severity: "High", status: "Approved", createdBy: "seed-script" },
  ]);

  return { allowancePolicies, leaveTypes, leavePolicies, positions, shifts, warningTypes };
};

const createEmployeesAndHistory = async ({ admin, positions, allowancePolicies }) => {
  const totalEmployees = 54;
  const managerialIndexes = new Set([3, 9, 15, 21, 27, 33, 39, 45, 51, 53]);
  const drafts = [];

  for (let index = 0; index < totalEmployees; index += 1) {
    const serial = index + 1;
    const position = managerialIndexes.has(serial)
      ? positions[(serial * 2) % positions.length]
      : positions[index % positions.length];
    const allowancePolicy = managerialIndexes.has(serial)
      ? allowancePolicies[2]
      : allowancePolicies[serial % allowancePolicies.length];
    const firstName = pick(FIRST_NAMES, serial);
    const lastName = pick(LAST_NAMES, serial * 2);
    const joinMonth = serial <= 20 ? 0 : serial <= 40 ? 1 : 2;
    const joinDay = ((serial * 3) % 20) + 1;
    const joiningDate = utcDate(2026, joinMonth, joinDay);

    let status = "Active";
    let resignationDate = null;
    if (serial >= 49 && serial <= 51) {
      status = "Resigned";
      resignationDate = utcDate(2026, 2, 8 + (serial - 49) * 2);
    } else if (serial === 52) {
      status = "Terminated";
      resignationDate = utcDate(2026, 1, 26);
    } else if (serial >= 53) {
      status = "Inactive";
    }

    const baseSalary = managerialIndexes.has(serial)
      ? 85000 + serial * 900
      : 34000 + serial * 650;

    drafts.push({
      position: position._id,
      allowancePolicy: allowancePolicy._id,
      basicSalary: baseSalary,
      status,
      employmentType:
        serial % 9 === 0 ? "Part Time" : serial % 5 === 0 ? "Contract" : "Permanent",
      fullName: `${firstName} ${lastName} ${MARKER} ${String(serial).padStart(2, "0")}`,
      employeeID: `${EMPLOYEE_PREFIX}${String(serial).padStart(3, "0")}`,
      gender: serial % 3 === 0 ? "Female" : "Male",
      fatherName: `Father ${lastName} ${serial}`,
      husbandName: "",
      joiningDate,
      resignationDate,
      cnic: `42201${String(260000000000 + serial).padStart(12, "0")}`,
      dob: utcDate(1990 + (serial % 8), serial % 12, ((serial * 2) % 27) + 1),
      contactNumber: `0300${String(1000000 + serial).padStart(7, "0")}`,
      province: "Sindh",
      city: "Karachi",
      maritalStatus: serial % 4 === 0 ? "Married" : "Single",
      currentStreetAddress: `${serial} ${MARKER} Street, Karachi`,
      permanentStreetAddress: `${serial} ${MARKER} Colony, Karachi`,
      emergencyContact: [
        {
          name: `Emergency ${serial}`,
          number: `0311${String(2000000 + serial).padStart(7, "0")}`,
          relation: "Brother",
        },
      ],
      medical: {
        bloodGroup: pick(["A+", "B+", "O+", "AB+"], serial),
        hasHealthIssues: serial % 12 === 0,
        healthIssueDetails: serial % 12 === 0 ? "Seasonal migraine" : "",
        disability: false,
        disabilityDetails: "",
      },
      education: [
        {
          qualification: managerialIndexes.has(serial) ? "MBA" : "Bachelors",
          institute: `${MARKER} Institute ${serial % 7}`,
          grades: serial % 4 === 0 ? "A" : "B+",
          status: "Completed",
        },
      ],
      previousExperience: [
        {
          company: `${MARKER} Previous Employer ${serial % 6}`,
          position: "Officer",
          from: utcDate(2023, serial % 12, 1),
          to: utcDate(2025, (serial + 3) % 12, 20),
          lastSalary: baseSalary - 5000,
        },
      ],
      guarantor: [
        {
          name: `Guarantor ${serial}`,
          contactNumber: `0321${String(3000000 + serial).padStart(7, "0")}`,
          cnic: `42301${String(360000000000 + serial).padStart(12, "0")}`,
          address: `${serial} ${MARKER} Block, Karachi`,
        },
      ],
      legal: {
        involvedInIllegalActivity: false,
        illegalActivityDetails: "",
        convictedBefore: false,
        convictedBeforeDetails: "",
        restrictedPlaces: false,
        restrictedPlacesDetails: "",
      },
    });
  }

  const employees = await Employee.insertMany(drafts);
  await PositionHistory.insertMany(
    employees.map((employee, index) => ({
      employee: employee._id,
      fromPosition: null,
      toPosition: drafts[index].position,
      changedBy: admin._id,
      changedAt: employee.joiningDate,
      effectiveDate: employee.joiningDate,
      reason: `${MARKER} initial position assignment`,
    })),
  );
  await BasicSalaryHistory.insertMany(
    employees.map((employee) => ({
      employee: employee._id,
      fromBasicSalary: 0,
      toBasicSalary: employee.basicSalary,
      changedBy: admin._id,
      changedAt: employee.joiningDate,
      effectiveDate: employee.joiningDate,
      reason: `${MARKER} initial salary assignment`,
    })),
  );
  await AllowancePolicyHistory.insertMany(
    employees.map((employee, index) => ({
      employee: employee._id,
      fromAllowancePolicy: null,
      toAllowancePolicy: drafts[index].allowancePolicy,
      changedBy: admin._id,
      changedAt: employee.joiningDate,
      effectiveDate: employee.joiningDate,
      reason: `${MARKER} initial allowance assignment`,
    })),
  );

  return employees;
};

const applyUpdatesAndAssignments = async ({ admin, employees, positions, allowancePolicies, shifts }) => {
  const promotionTargets = [5, 11, 18, 24, 30, 37];
  const salaryRaiseTargets = [2, 6, 8, 13, 17, 22, 28, 35, 41, 47];
  const policyChangeTargets = [4, 10, 16, 20, 26, 32, 38, 44];

  for (const serial of promotionTargets) {
    const employee = employees[serial - 1];
    const currentPosition = await Position.findById(employee.position);
    const sameDeptPositions = await Position.find({
      department: currentPosition.department,
      _id: { $ne: currentPosition._id },
    }).sort({ createdAt: 1 });
    const promotedPosition = sameDeptPositions[sameDeptPositions.length - 1];
    if (!promotedPosition) continue;

    employee.position = promotedPosition._id;
    await employee.save();
    await PositionHistory.create({
      employee: employee._id,
      fromPosition: currentPosition._id,
      toPosition: promotedPosition._id,
      changedBy: admin._id,
      changedAt: utcDate(2026, 1, 20, 10),
      effectiveDate: utcDate(2026, 1, 20),
      reason: `${MARKER} promotion`,
    });
  }

  for (const serial of salaryRaiseTargets) {
    const employee = employees[serial - 1];
    const nextSalary = Number(employee.basicSalary) + 4500 + serial * 25;
    await BasicSalaryHistory.create({
      employee: employee._id,
      fromBasicSalary: employee.basicSalary,
      toBasicSalary: nextSalary,
      changedBy: admin._id,
      changedAt: utcDate(2026, 1, 10, 9),
      effectiveDate: utcDate(2026, 1, 10),
      reason: `${MARKER} salary revision`,
    });
    employee.basicSalary = nextSalary;
    await employee.save();
  }

  for (const serial of policyChangeTargets) {
    const employee = employees[serial - 1];
    const nextPolicy = allowancePolicies[serial % allowancePolicies.length];
    if (String(employee.allowancePolicy) === String(nextPolicy._id)) continue;
    await AllowancePolicyHistory.create({
      employee: employee._id,
      fromAllowancePolicy: employee.allowancePolicy,
      toAllowancePolicy: nextPolicy._id,
      changedBy: admin._id,
      changedAt: utcDate(2026, 1, 5, 9),
      effectiveDate: utcDate(2026, 1, 5),
      reason: `${MARKER} allowance policy change`,
    });
    employee.allowancePolicy = nextPolicy._id;
    await employee.save();
  }

  await AllowancePolicyAmountHistory.insertMany(
    allowancePolicies.map((policy) => ({
      allowancePolicy: policy._id,
      fromComponents: policy.components.map((item) => ({
        allowanceComponent: item.allowanceComponent,
        amount: item.amount,
      })),
      toComponents: policy.components.map((item, index) => ({
        allowanceComponent: item.allowanceComponent,
        amount: Number(item.amount) + (index + 1) * 500,
      })),
      effectiveDate: utcDate(2026, 1, 1),
      changedBy: admin._id,
      changedAt: utcDate(2026, 0, 28, 15),
      reason: `${MARKER} February revision`,
    })),
  );

  const employeeShiftDocs = [];
  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index];
    const firstEffectiveDate = employee.joiningDate > START_DATE
      ? atUtcMidnight(employee.joiningDate)
      : START_DATE;
    const initialShift = shifts[index % shifts.length];

    if ((index + 1) % 7 === 0) {
      const changeDate = utcDate(2026, 1, 16);
      employeeShiftDocs.push({
        employee: employee._id,
        shift: initialShift._id,
        effectiveDate: firstEffectiveDate,
        endDate: addDays(changeDate, -1),
        assignedBy: admin._id,
      });
      employeeShiftDocs.push({
        employee: employee._id,
        shift: shifts[(index + 1) % shifts.length]._id,
        effectiveDate: changeDate,
        endDate: null,
        assignedBy: admin._id,
      });
    } else {
      employeeShiftDocs.push({
        employee: employee._id,
        shift: initialShift._id,
        effectiveDate: firstEffectiveDate,
        endDate: null,
        assignedBy: admin._id,
      });
    }
  }

  return EmployeeShift.insertMany(employeeShiftDocs);
};

const createLeaveBalances = async (employees) => {
  const positions = await Position.find({ _id: { $in: employees.map((item) => item.position) } })
    .populate({
      path: "leavePolicy",
      populate: { path: "entitlements.leaveType", select: "_id name" },
    });
  const positionMap = new Map(positions.map((item) => [String(item._id), item]));

  const docs = [];
  for (const employee of employees) {
    const position = positionMap.get(String(employee.position));
    for (const entitlement of position.leavePolicy.entitlements) {
      docs.push({
        employee: employee._id,
        leaveType: entitlement.leaveType._id,
        totalDays: entitlement.days,
        usedDays: 0,
        remainingDays: entitlement.days,
        year: 2026,
      });
    }
  }
  return LeaveBalance.insertMany(docs);
};

const createLeaveApplications = async ({
  admin,
  supervisor,
  employees,
  leaveTypes,
  leaveBalances,
  employeeShiftDocs,
}) => {
  const balancesByKey = new Map();
  for (const balance of leaveBalances) {
    balancesByKey.set(
      `${balance.employee.toString()}__${balance.leaveType.toString()}`,
      balance,
    );
  }

  const assignmentsByEmployee = new Map();
  for (const assignment of employeeShiftDocs) {
    const key = assignment.employee.toString();
    if (!assignmentsByEmployee.has(key)) assignmentsByEmployee.set(key, []);
    assignmentsByEmployee.get(key).push(assignment);
  }
  for (const items of assignmentsByEmployee.values()) {
    items.sort((a, b) => a.effectiveDate - b.effectiveDate);
  }

  const applications = [];
  const approvedLeaveByEmployeeDate = new Map();
  const makeRange = (year, monthIndex, startDay, endDay) => ({
    startDate: utcDate(year, monthIndex, startDay),
    endDate: utcDate(year, monthIndex, endDay),
  });

  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index];
    const serial = index + 1;

    if (serial <= 28) {
      const ranges = serial % 2 === 0
        ? [makeRange(2026, 0, 12 + (serial % 5), 13 + (serial % 5))]
        : [makeRange(2026, 1, 3 + (serial % 6), 4 + (serial % 6))];
      const dates = getLeaveDatesFromRanges(ranges);
      applications.push({
        employee: employee._id,
        leaveType: leaveTypes[serial % leaveTypes.length]._id,
        dateRanges: ranges,
        dates,
        daysCount: dates.length,
        reason: `${MARKER} approved leave ${serial}`,
        status: "Approved",
        appliedBy: serial % 3 === 0 ? supervisor._id : admin._id,
        approvedBy: admin._id,
        createdBy: "seed-script",
      });
    }

    if (serial <= 12) {
      const ranges = [makeRange(2026, 2, 10 + (serial % 4), 10 + (serial % 4))];
      const dates = getLeaveDatesFromRanges(ranges);
      applications.push({
        employee: employee._id,
        leaveType: leaveTypes[(serial + 1) % leaveTypes.length]._id,
        dateRanges: ranges,
        dates,
        daysCount: dates.length,
        reason: `${MARKER} pending leave ${serial}`,
        status: "Pending",
        appliedBy: supervisor._id,
        approvedBy: null,
        createdBy: "seed-script",
      });
    }

    if (serial <= 8) {
      const ranges = [makeRange(2026, 0, 20 + (serial % 3), 20 + (serial % 3))];
      const dates = getLeaveDatesFromRanges(ranges);
      applications.push({
        employee: employee._id,
        leaveType: leaveTypes[3]._id,
        dateRanges: ranges,
        dates,
        daysCount: dates.length,
        reason: `${MARKER} rejected leave ${serial}`,
        status: "Rejected",
        appliedBy: supervisor._id,
        approvedBy: admin._id,
        createdBy: "seed-script",
      });
    }
  }

  const insertedApplications = await LeaveApplication.insertMany(applications);

  for (const application of insertedApplications) {
    if (application.status !== "Rejected") {
      const balance = balancesByKey.get(
        `${application.employee.toString()}__${application.leaveType.toString()}`,
      );
      if (balance) {
        balance.usedDays += application.daysCount;
        balance.remainingDays = Math.max(0, balance.totalDays - balance.usedDays);
      }
    }
    if (application.status === "Approved") {
      for (const date of application.dates) {
        approvedLeaveByEmployeeDate.set(
          `${application.employee.toString()}__${formatDate(date)}`,
          application,
        );
      }
    }
  }

  await Promise.all([...balancesByKey.values()].map((item) => item.save()));
  return { assignmentsByEmployee, approvedLeaveByEmployeeDate };
};

const createAttendance = async ({
  admin,
  employees,
  shifts,
  assignmentsByEmployee,
  approvedLeaveByEmployeeDate,
}) => {
  const shiftMap = new Map(shifts.map((shift) => [String(shift._id), shift]));
  const docs = [];

  for (let index = 0; index < employees.length; index += 1) {
    const employee = employees[index];
    const start = employee.joiningDate > START_DATE
      ? atUtcMidnight(employee.joiningDate)
      : START_DATE;
    const end = employee.resignationDate && atUtcMidnight(employee.resignationDate) < END_DATE
      ? atUtcMidnight(employee.resignationDate)
      : END_DATE;
    if (start > end) continue;

    const assignments = assignmentsByEmployee.get(employee._id.toString()) || [];
    for (const date of enumerateDates(start, end)) {
      const leaveApplication = approvedLeaveByEmployeeDate.get(
        `${employee._id.toString()}__${formatDate(date)}`,
      );
      const shiftRef = getShiftForDate(assignments, date);
      const assignedShift = shiftRef ? shiftMap.get(String(shiftRef.shift || shiftRef)) : null;
      if (!assignedShift) continue;

      if (leaveApplication) {
        docs.push({
          employee: employee._id,
          date,
          status: "Leave",
          shift: null,
          checkIn: null,
          checkOut: null,
          lateDurationMinutes: 0,
          workHours: null,
          source: "leave_auto",
          lockReason: "approved_leave",
          linkedLeaveApplication: leaveApplication._id,
          markedBy: admin._id,
        });
        continue;
      }

      if (!assignedShift.workingDays.includes(dayName(date))) {
        docs.push({
          employee: employee._id,
          date,
          status: "Off",
          shift: assignedShift._id,
          checkIn: null,
          checkOut: null,
          lateDurationMinutes: 0,
          workHours: null,
          source: "manual",
          lockReason: null,
          linkedLeaveApplication: null,
          markedBy: admin._id,
        });
        continue;
      }

      const serial = index + 1;
      const score = (serial * 17 + date.getUTCDate() * 7 + (date.getUTCMonth() + 1) * 13) % 100;
      let status = "Present";
      if (score < 6) status = "Absent";
      else if (score < 16) status = "Late";
      else if (score < 24) status = "Half Day";

      let checkIn = null;
      let checkOut = null;
      let lateDurationMinutes = 0;
      let workHours = null;

      if (status !== "Absent") {
        checkIn = buildDateTime(date, assignedShift.startTime);
        checkOut = buildDateTime(date, assignedShift.endTime);
        if (status === "Late") {
          lateDurationMinutes = 18 + (serial % 20);
          checkIn.setUTCMinutes(checkIn.getUTCMinutes() + lateDurationMinutes);
          workHours = 7.4;
        } else if (status === "Half Day") {
          checkOut.setUTCHours(checkOut.getUTCHours() - 4);
          workHours = 4;
        } else {
          workHours = 8;
        }
      }

      docs.push({
        employee: employee._id,
        date,
        status,
        shift: assignedShift._id,
        checkIn,
        checkOut,
        lateDurationMinutes,
        workHours,
        source: "manual",
        lockReason: null,
        linkedLeaveApplication: null,
        markedBy: admin._id,
      });
    }
  }

  return Attendance.insertMany(docs, { ordered: false });
};

const createDeductions = async ({ admin, employees }) =>
  Deduction.insertMany(
    employees.flatMap((employee, index) => {
      if (index % 3 !== 0) return [];
      const rows = [
        {
          employee: employee._id,
          amount: 800 + (index % 5) * 250,
          date: utcDate(2026, 0, 25),
          reason: `${MARKER} late fine batch January`,
          createdBy: admin._id,
        },
        {
          employee: employee._id,
          amount: 1200 + (index % 4) * 300,
          date: utcDate(2026, 1, 26),
          reason: `${MARKER} advance adjustment February`,
          createdBy: admin._id,
        },
      ];
      if (index % 2 === 0) {
        rows.push({
          employee: employee._id,
          amount: 600 + (index % 3) * 200,
          date: utcDate(2026, 2, 12),
          reason: `${MARKER} canteen recovery March`,
          createdBy: admin._id,
        });
      }
      return rows;
    }),
  );

const createDisciplinaryActions = async ({ employees, warningTypes }) =>
  DisciplinaryAction.insertMany(
    Array.from({ length: 15 }, (_, index) => ({
      employee: employees[index * 2]._id,
      warningType: warningTypes[index % warningTypes.length]._id,
      description: `${MARKER} disciplinary note ${index + 1}`,
      actionDate: utcDate(2026, index % 3, 5 + index),
      status: index < 10 ? "Active" : "Inactive",
      createdBy: "seed-script",
    })),
  );

const createWorkProgressReports = async ({ admin, supervisor, employees }) => {
  const statuses = [
    "Pending",
    "In Progress",
    "Completed (Early)",
    "Completed (On Time)",
    "Completed (Late)",
    "Closed (On Time)",
    "Closed (Late)",
  ];

  return WorkProgressReport.insertMany(
    Array.from({ length: 28 }, (_, index) => {
      const employee = employees[index];
      const supportEmployee = employees[(index + 7) % employees.length];
      const assignmentDate = utcDate(2026, index % 3, 2 + (index % 20));
      const deadline = addDays(assignmentDate, 4 + (index % 6));
      const status = statuses[index % statuses.length];
      const completed =
        status.startsWith("Completed") || status.startsWith("Closed");
      const completionDate = completed
        ? addDays(
            deadline,
            status.includes("Late") ? 2 : status.includes("Early") ? -1 : 0,
          )
        : null;

      return {
        employees:
          index % 4 === 0 ? [employee._id, supportEmployee._id] : [employee._id],
        assignmentDate,
        deadline,
        daysForCompletion: 4 + (index % 6),
        taskDescription: `${MARKER} dashboard sample task ${index + 1}`,
        status,
        startDate: addDays(assignmentDate, 1),
        completionDate,
        assignedBy: { user: admin._id, name: admin.name },
        startedBy: { user: supervisor._id, name: supervisor.name },
        completedBy: completed
          ? { user: admin._id, name: admin.name }
          : { user: null, name: "" },
        closedBy: status.startsWith("Closed")
          ? { user: admin._id, name: admin.name }
          : { user: null, name: "" },
        closingRemarks: status.startsWith("Closed")
          ? `${MARKER} task closed after review`
          : "",
        rating: completed ? 3 + (index % 3) : null,
        remarks: [
          {
            addedBy: { user: supervisor._id, name: supervisor.name },
            date: addDays(assignmentDate, 2),
            text: `${MARKER} progress updated`,
            createdAt: addDays(assignmentDate, 2),
          },
        ],
        timeline: [
          {
            action: "Task Assigned",
            performedBy: { user: admin._id, name: admin.name },
            timestamp: assignmentDate,
            details: `${MARKER} task assigned`,
          },
          {
            action: "Task Started",
            performedBy: { user: supervisor._id, name: supervisor.name },
            timestamp: addDays(assignmentDate, 1),
            details: `${MARKER} work started`,
          },
        ],
      };
    }),
  );
};

const createContracts = async () => {
  const contracts = await Contract.insertMany([
    {
      contractName: `${MARKER} Site Labor Alpha`,
      startDate: utcDate(2026, 0, 1),
      endDate: utcDate(2026, 2, 25),
      numberOfLabors: 18,
      contractAmount: 1450000,
      status: "Active",
      perLaborCostPerDay: 2400,
      totalDays: 84,
      totalDaysWorked: 0,
      suspendedDate: null,
      createdBy: "seed-script",
    },
    {
      contractName: `${MARKER} Warehouse Loading Beta`,
      startDate: utcDate(2026, 0, 10),
      endDate: utcDate(2026, 2, 16),
      numberOfLabors: 12,
      contractAmount: 890000,
      status: "Completed",
      perLaborCostPerDay: 2100,
      totalDays: 66,
      totalDaysWorked: 0,
      suspendedDate: null,
      createdBy: "seed-script",
    },
    {
      contractName: `${MARKER} Cleaning Gamma`,
      startDate: utcDate(2026, 1, 1),
      endDate: utcDate(2026, 2, 30),
      numberOfLabors: 9,
      contractAmount: 620000,
      status: "Suspended",
      perLaborCostPerDay: 1800,
      totalDays: 58,
      totalDaysWorked: 0,
      suspendedDate: utcDate(2026, 2, 12),
      createdBy: "seed-script",
    },
  ]);

  const attendanceDocs = [];
  const paymentDocs = [];

  for (const contract of contracts) {
    let workedDays = 0;
    const rangeEnd = contract.endDate < END_DATE ? contract.endDate : END_DATE;
    for (const date of enumerateDates(contract.startDate, rangeEnd)) {
      if (dayName(date) === "Sunday") continue;
      if (contract.status === "Suspended" && contract.suspendedDate && date > contract.suspendedDate) {
        continue;
      }
      const laborersPresent = Math.max(
        4,
        contract.numberOfLabors - ((date.getUTCDate() + workedDays) % 3),
      );
      attendanceDocs.push({
        contractId: contract._id,
        date,
        laborersPresent,
        dayCost: laborersPresent * contract.perLaborCostPerDay,
      });
      workedDays += 1;
    }

    contract.totalDaysWorked = workedDays;
    await contract.save();

    paymentDocs.push({
      contractId: contract._id,
      paymentDate: addDays(contract.startDate, 20),
      amountPaid: Math.round(contract.contractAmount * 0.35),
      paymentNote: `${MARKER} first installment`,
      createdBy: "seed-script",
    });
    paymentDocs.push({
      contractId: contract._id,
      paymentDate: addDays(contract.startDate, 45),
      amountPaid: Math.round(contract.contractAmount * 0.25),
      paymentNote: `${MARKER} second installment`,
      createdBy: "seed-script",
    });
  }

  await ContractAttendance.insertMany(attendanceDocs);
  await ContractPayment.insertMany(paymentDocs);
};

const createPayrolls = async ({ admin, employees }) => {
  for (const month of PAYROLL_MONTHS) {
    for (const employee of employees) {
      const snapshotEmployee = await payrollSnapshotEmployee(employee._id);
      const payload = await calculateEmployeePayroll({
        employee: snapshotEmployee,
        year: 2026,
        month,
        generatedBy: admin._id,
        mode: "normal",
        includeArrears: true,
        skipArrearsSync: false,
        AllowancePolicyModel: AllowancePolicy,
      });

      const payroll = await Payroll.create(payload);
      if ((payload.arrearsLedgerEntries || []).length) {
        await settleArrearsForPayroll({
          payrollId: payroll._id,
          arrearsLedgerEntryIds: payload.arrearsLedgerEntries,
        });
      }
    }

    if (month === 1) {
      await PayrollArrearsLedger.insertMany(
        employees.slice(0, 6).map((employee, index) => ({
          employee: employee._id,
          sourceYear: 2026,
          sourceMonth: 1,
          amount: 1200 + index * 350,
          reason: `${MARKER} January backdated adjustment`,
          createdBy: admin._id,
          settled: false,
        })),
      );
    }
  }

  await PayrollArrearsLedger.insertMany(
    employees.slice(10, 14).map((employee, index) => ({
      employee: employee._id,
      sourceYear: 2026,
      sourceMonth: 2,
      amount: 900 + index * 275,
      reason: `${MARKER} February pending arrears for March`,
      createdBy: admin._id,
      settled: false,
    })),
  );
};

const refreshHeadcounts = async () => {
  const positions = await Position.find({ name: { $regex: MARKER, $options: "i" } });
  for (const position of positions) {
    position.hiredEmployees = await Employee.countDocuments({
      position: position._id,
      status: "Active",
    });
    await position.save();
  }

  const departments = await Department.find({ name: { $regex: MARKER, $options: "i" } });
  for (const department of departments) {
    const positionIds = await Position.find({ department: department._id }).distinct("_id");
    department.employeeCount = await Employee.countDocuments({
      position: { $in: positionIds },
      status: "Active",
    });
    await department.save();
  }
};

const summarizeCounts = async () => {
  const employeeIds = await Employee.find({
    employeeID: { $regex: `^${EMPLOYEE_PREFIX}` },
  }).distinct("_id");
  const contractIds = await Contract.find({
    contractName: { $regex: MARKER, $options: "i" },
  }).distinct("_id");

  return {
    users: await User.countDocuments({ username: { $regex: "^seed26-" } }),
    departments: await Department.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    positions: await Position.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    employees: await Employee.countDocuments({ _id: { $in: employeeIds } }),
    shifts: await Shift.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    leaveTypes: await LeaveType.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    leavePolicies: await LeavePolicy.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    leaveApplications: await LeaveApplication.countDocuments({ employee: { $in: employeeIds } }),
    leaveBalances: await LeaveBalance.countDocuments({ employee: { $in: employeeIds } }),
    attendance: await Attendance.countDocuments({ employee: { $in: employeeIds } }),
    summaries: await MonthlyAttendanceSummary.countDocuments({ employee: { $in: employeeIds } }),
    payrolls: await Payroll.countDocuments({ employee: { $in: employeeIds } }),
    arrears: await PayrollArrearsLedger.countDocuments({ employee: { $in: employeeIds } }),
    deductions: await Deduction.countDocuments({ employee: { $in: employeeIds } }),
    disciplinary: await DisciplinaryAction.countDocuments({ employee: { $in: employeeIds } }),
    warningTypes: await WarningType.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    workReports: await WorkProgressReport.countDocuments({ taskDescription: { $regex: MARKER, $options: "i" } }),
    contracts: await Contract.countDocuments({ _id: { $in: contractIds } }),
    contractAttendance: await ContractAttendance.countDocuments({ contractId: { $in: contractIds } }),
    contractPayments: await ContractPayment.countDocuments({ contractId: { $in: contractIds } }),
    allowanceComponents: await AllowanceComponent.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    allowancePolicies: await AllowancePolicy.countDocuments({ name: { $regex: MARKER, $options: "i" } }),
    salaryHistory: await BasicSalaryHistory.countDocuments({ employee: { $in: employeeIds } }),
    allowanceHistory: await AllowancePolicyHistory.countDocuments({ employee: { $in: employeeIds } }),
    positionHistory: await PositionHistory.countDocuments({ employee: { $in: employeeIds } }),
    allowanceAmountHistory: await AllowancePolicyAmountHistory.countDocuments({
      allowancePolicy: {
        $in: await AllowancePolicy.find({ name: { $regex: MARKER, $options: "i" } }).distinct("_id"),
      },
    }),
  };
};

const main = async () => {
  await connectDB();

  console.log("Cleaning existing seed data...");
  await cleanupSeedData();

  console.log("Creating base setup...");
  const { admin, supervisor } = await createUsers();
  const baseSetup = await createBaseSetup(admin);

  console.log("Creating employees...");
  const employees = await createEmployeesAndHistory({
    admin,
    positions: baseSetup.positions,
    allowancePolicies: baseSetup.allowancePolicies,
  });
  const employeeShiftDocs = await applyUpdatesAndAssignments({
    admin,
    employees,
    positions: baseSetup.positions,
    allowancePolicies: baseSetup.allowancePolicies,
    shifts: baseSetup.shifts,
  });
  const leaveBalances = await createLeaveBalances(employees);

  console.log("Creating transactional data...");
  const { assignmentsByEmployee, approvedLeaveByEmployeeDate } =
    await createLeaveApplications({
      admin,
      supervisor,
      employees,
      leaveTypes: baseSetup.leaveTypes,
      leaveBalances,
      employeeShiftDocs,
    });
  const attendanceDocs = await createAttendance({
    admin,
    employees,
    shifts: baseSetup.shifts,
    assignmentsByEmployee,
    approvedLeaveByEmployeeDate,
  });
  await MonthlyAttendanceSummary.insertMany(buildMonthlySummaryDocs(attendanceDocs));
  await createDeductions({ admin, employees });
  await createDisciplinaryActions({
    employees,
    warningTypes: baseSetup.warningTypes,
  });
  await createWorkProgressReports({ admin, supervisor, employees });
  await createContracts();

  console.log("Creating payrolls...");
  await createPayrolls({ admin, employees });
  await refreshHeadcounts();

  console.log("Seed completed successfully.");
  console.table(await summarizeCounts());
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
