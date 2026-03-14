import WorkProgressReport from "../models/WorkProgressReport.js";
import Employee from "../models/Employee.js";
import Position from "../models/Position.js";
import mongoose from "mongoose";

// ──────────────────────────────────────────────
// Helper: Get current server time (UTC).
// All timestamps are recorded server-side in UTC.
// Frontend should display times in GMT+5 (PKT) by
// converting: new Date(timestamp).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })
// ──────────────────────────────────────────────
const getServerTimestamp = () => new Date();

// ──────────────────────────────────────────────
// @description     Search employees by name or ID (for task assignment modal)
// @route           GET /api/work-progress-reports/search-employees?q=
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const searchEmployees = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.json([]);
    }

    const employees = await Employee.find({
      status: "Active",
      $or: [
        { fullName: { $regex: q, $options: "i" } },
        { employeeID: { $regex: q, $options: "i" } },
      ],
    })
      .select("fullName employeeID")
      .limit(10)
      .lean();

    res.json(employees);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Get all work progress reports (paginated)
// @route           GET /api/work-progress-reports
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const getAllWorkProgressReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $lookup: {
          from: "employees",
          localField: "employees",
          foreignField: "_id",
          as: "employees",
        },
      },
    ];

    if (searchText.trim()) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employees.fullName": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "employees.employeeID": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              taskDescription: {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "assignedBy.name": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
          ],
        },
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await WorkProgressReport.aggregate(countPipeline);
    const totalReports = countResult[0]?.total || 0;

    // Fetch paginated
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 1,
        employees: { _id: 1, fullName: 1, employeeID: 1 },
        assignmentDate: 1,
        deadline: 1,
        daysForCompletion: 1,
        taskDescription: 1,
        status: 1,
        startDate: 1,
        completionDate: 1,
        assignedBy: 1,
        rating: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    const reports = await WorkProgressReport.aggregate(pipeline);

    res.json({
      workProgressReports: reports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalReports / limit),
        totalReports,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Get work progress report by ID (View Details)
// @route           GET /api/work-progress-reports/:id
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const getWorkProgressReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id)
      .populate("employees", "fullName employeeID")
      .lean();

    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    // Calculate day statistics for completed/closed tasks
    // Normalize dates in UTC+5 (Asia/Karachi) to avoid day-boundary issues
    // e.g. "Feb 22 PKT" is stored as "Feb 21 19:00 UTC"; setHours(0,0,0,0)
    // would wrongly shift it to "Feb 21 UTC midnight".
    const toUtc5DateOnly = (date) => {
      const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000;
      const d = new Date(new Date(date).getTime() + UTC5_OFFSET_MS);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    const COMPLETED_OR_CLOSED_STATUSES = [
      "Completed (Early)",
      "Completed (On Time)",
      "Completed (Late)",
      "Closed (Early)",
      "Closed (On Time)",
      "Closed (Late)",
      "Closed", // legacy
    ];

    if (
      report.completionDate &&
      COMPLETED_OR_CLOSED_STATUSES.includes(report.status)
    ) {
      const assignTs = toUtc5DateOnly(report.assignmentDate);
      const deadlineTs = toUtc5DateOnly(report.deadline);
      const completionTs = toUtc5DateOnly(report.completionDate);

      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const daysPassed = Math.round((completionTs - assignTs) / MS_PER_DAY);
      const totalDaysAllowed = Math.round((deadlineTs - assignTs) / MS_PER_DAY);
      const remainingDays = totalDaysAllowed - daysPassed;

      report.dayStats = {
        daysPassed,
        totalDaysAllowed,
        remainingDays,
        completedOnTime: completionTs <= deadlineTs,
        completedLate: completionTs > deadlineTs,
      };
    }

    res.json(report);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Create new work progress report (Assign Task)
// @route           POST /api/work-progress-reports
// @access          Admin only
// ──────────────────────────────────────────────
export const createWorkProgressReport = async (req, res, next) => {
  try {
    const {
      employees,
      assignmentDate,
      deadline,
      daysForCompletion,
      taskDescription,
    } = req.body || {};

    // Validate employees array
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      res.status(400);
      throw new Error("At least one employee is required");
    }

    // Validate all employee IDs
    for (const empId of employees) {
      if (!mongoose.Types.ObjectId.isValid(empId)) {
        res.status(400);
        throw new Error(`Invalid employee ID: ${empId}`);
      }
    }

    // Check for duplicates in the submitted array
    const uniqueEmployees = [...new Set(employees.map(String))];
    if (uniqueEmployees.length !== employees.length) {
      res.status(400);
      throw new Error("Duplicate employees are not allowed");
    }

    // Verify all employees exist
    const employeeDocs = await Employee.find({
      _id: { $in: uniqueEmployees },
    }).select("_id fullName employeeID");

    if (employeeDocs.length !== uniqueEmployees.length) {
      res.status(404);
      throw new Error("One or more employees not found");
    }

    if (!assignmentDate) {
      res.status(400);
      throw new Error("Assignment date is required");
    }

    if (!deadline) {
      res.status(400);
      throw new Error("Deadline is required");
    }

    const assignDate = new Date(assignmentDate);
    const deadlineDate = new Date(deadline);

    if (deadlineDate <= assignDate) {
      res.status(400);
      throw new Error("Deadline must be after the assignment date");
    }

    if (!daysForCompletion || daysForCompletion < 1) {
      res.status(400);
      throw new Error("Days for completion must be at least 1");
    }

    if (!taskDescription?.trim()) {
      res.status(400);
      throw new Error("Task description is required");
    }

    const now = getServerTimestamp();

    const newReport = new WorkProgressReport({
      employees: uniqueEmployees,
      assignmentDate: assignDate,
      deadline: deadlineDate,
      daysForCompletion,
      taskDescription: taskDescription.trim(),
      status: "Pending",
      assignedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      timeline: [
        {
          action: "Task Assigned",
          performedBy: {
            user: req.user._id,
            name: req.user.name || String(req.user._id),
          },
          timestamp: now,
          details: `Task assigned to ${employeeDocs.map((e) => e.fullName).join(", ")}`,
        },
      ],
    });

    const savedReport = await newReport.save();

    const populatedReport = await WorkProgressReport.findById(savedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.status(201).json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Update/Edit work progress report (only Pending tasks)
// @route           PUT /api/work-progress-reports/:id
// @access          Admin only
// Editable fields: employees, assignmentDate, deadline, daysForCompletion, taskDescription
// ──────────────────────────────────────────────
export const updateWorkProgressReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    // Only allow editing Pending tasks
    if (report.status !== "Pending") {
      res.status(400);
      throw new Error(
        "Only tasks with Pending status can be edited. Current status: " +
          report.status,
      );
    }

    const {
      employees,
      assignmentDate,
      deadline,
      daysForCompletion,
      taskDescription,
    } = req.body || {};

    // Validate employees if provided
    if (employees !== undefined) {
      if (!Array.isArray(employees) || employees.length === 0) {
        res.status(400);
        throw new Error("At least one employee is required");
      }

      for (const empId of employees) {
        if (!mongoose.Types.ObjectId.isValid(empId)) {
          res.status(400);
          throw new Error(`Invalid employee ID: ${empId}`);
        }
      }

      const uniqueEmployees = [...new Set(employees.map(String))];
      if (uniqueEmployees.length !== employees.length) {
        res.status(400);
        throw new Error("Duplicate employees are not allowed");
      }

      const employeeDocs = await Employee.find({
        _id: { $in: uniqueEmployees },
      }).select("_id");

      if (employeeDocs.length !== uniqueEmployees.length) {
        res.status(404);
        throw new Error("One or more employees not found");
      }

      report.employees = uniqueEmployees;
    }

    if (assignmentDate) {
      report.assignmentDate = new Date(assignmentDate);
    }

    if (deadline) {
      report.deadline = new Date(deadline);
    }

    // Validate deadline > assignmentDate
    const effectiveAssignDate = new Date(
      assignmentDate || report.assignmentDate,
    );
    const effectiveDeadline = new Date(deadline || report.deadline);
    if (effectiveDeadline <= effectiveAssignDate) {
      res.status(400);
      throw new Error("Deadline must be after the assignment date");
    }

    if (daysForCompletion !== undefined) {
      if (daysForCompletion < 1) {
        res.status(400);
        throw new Error("Days for completion must be at least 1");
      }
      report.daysForCompletion = daysForCompletion;
    }

    if (taskDescription !== undefined) {
      if (!taskDescription?.trim()) {
        res.status(400);
        throw new Error("Task description is required");
      }
      report.taskDescription = taskDescription.trim();
    }

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(updatedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Start Task (Pending → In Progress)
// @route           PUT /api/work-progress-reports/:id/start
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const startTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    if (report.status !== "Pending") {
      res.status(400);
      throw new Error(
        "Only tasks with Pending status can be started. Current status: " +
          report.status,
      );
    }

    const now = getServerTimestamp();

    report.status = "In Progress";
    report.startDate = now;
    report.startedBy = {
      user: req.user._id,
      name: req.user.name || String(req.user._id),
    };

    report.timeline.push({
      action: "Task Started",
      performedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      timestamp: now,
      details: "Task started",
    });

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(updatedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Complete Task (In Progress → Completed)
// @route           PUT /api/work-progress-reports/:id/complete
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const completeTask = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    if (report.status !== "In Progress") {
      res.status(400);
      throw new Error(
        "Only tasks with In Progress status can be completed. Current status: " +
          report.status,
      );
    }

    const now = getServerTimestamp();

    // Use UTC+5 date-only comparison to determine Early / On Time / Late
    const UTC5_OFFSET_MS = 5 * 60 * 60 * 1000;
    const toUtc5DateOnly = (date) => {
      const d = new Date(new Date(date).getTime() + UTC5_OFFSET_MS);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    const deadlineTs = toUtc5DateOnly(report.deadline);
    const completionTs = toUtc5DateOnly(now);

    let completionStatus;
    let completionDetails;
    if (completionTs < deadlineTs) {
      completionStatus = "Completed (Early)";
      completionDetails = "Task completed early (before deadline)";
    } else if (completionTs === deadlineTs) {
      completionStatus = "Completed (On Time)";
      completionDetails = "Task completed on time";
    } else {
      completionStatus = "Completed (Late)";
      completionDetails = "Task completed late";
    }

    report.status = completionStatus;
    report.completionDate = now;
    report.completedBy = {
      user: req.user._id,
      name: req.user.name || String(req.user._id),
    };

    report.timeline.push({
      action: "Task Completed",
      performedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      timestamp: now,
      details: completionDetails,
    });

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(updatedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Add Remarks to a task
// @route           POST /api/work-progress-reports/:id/remarks
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const addRemarks = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, text } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    // Remarks cannot be added to Closed tasks (any variant)
    const isClosedStatus = [
      "Closed",
      "Closed (Early)",
      "Closed (On Time)",
      "Closed (Late)",
    ].includes(report.status);
    if (isClosedStatus) {
      res.status(400);
      throw new Error("Cannot add remarks to a closed task");
    }

    if (!date) {
      res.status(400);
      throw new Error("Remarks date is required");
    }

    if (!text?.trim()) {
      res.status(400);
      throw new Error("Remarks text is required");
    }

    const now = getServerTimestamp();

    report.remarks.push({
      addedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      date: new Date(date),
      text: text.trim(),
      createdAt: now,
    });

    report.timeline.push({
      action: "Remarks Added",
      performedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      timestamp: now,
      details: text.trim(),
    });

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(updatedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Close Task (Completed → Closed) with final remarks & rating
// @route           PUT /api/work-progress-reports/:id/close
// @access          Admin only
// ──────────────────────────────────────────────
export const closeTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { closingRemarks, rating } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id);
    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    if (
      report.status !== "Completed (Early)" &&
      report.status !== "Completed (On Time)" &&
      report.status !== "Completed (Late)"
    ) {
      res.status(400);
      throw new Error(
        "Only completed tasks can be closed. Current status: " + report.status,
      );
    }

    if (!closingRemarks?.trim()) {
      res.status(400);
      throw new Error("Closing remarks are required");
    }

    if (rating === undefined || rating === null) {
      res.status(400);
      throw new Error("Rating is required");
    }

    const ratingNum = parseFloat(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      res.status(400);
      throw new Error("Rating must be between 0 and 5");
    }

    // Validate 0.1 increments
    const rounded = Math.round(ratingNum * 10) / 10;
    if (rounded !== ratingNum) {
      res.status(400);
      throw new Error("Rating must be in 0.1 increments (e.g., 3.7, 4.5)");
    }

    const now = getServerTimestamp();

    // Preserve timing info from the Completed status
    const closedStatusMap = {
      "Completed (Early)": "Closed (Early)",
      "Completed (On Time)": "Closed (On Time)",
      "Completed (Late)": "Closed (Late)",
    };
    report.status = closedStatusMap[report.status] || "Closed";
    report.closingRemarks = closingRemarks.trim();
    report.rating = rounded;
    report.closedBy = {
      user: req.user._id,
      name: req.user.name || String(req.user._id),
    };

    report.timeline.push({
      action: "Task Closed",
      performedBy: {
        user: req.user._id,
        name: req.user.name || String(req.user._id),
      },
      timestamp: now,
      details: `Task closed with rating ${rounded}/5. Remarks: ${closingRemarks.trim()}`,
    });

    const updatedReport = await report.save();

    const populatedReport = await WorkProgressReport.findById(updatedReport._id)
      .populate("employees", "fullName employeeID")
      .lean();

    res.json(populatedReport);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// ──────────────────────────────────────────────
// @description     Get employee progress reports (aggregated tasks completed & avg rating)
// @route           GET /api/work-progress-reports/employee-progress
// @access          Admin, Supervisor
// ──────────────────────────────────────────────
export const getEmployeeProgressReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";
    const statusFilter = req.query.status || "";
    const typeFilter = req.query.type || "";
    const positionFilter = req.query.position || "";
    const departmentFilter = req.query.department || "";

    // Time period filters
    const periodType = req.query.periodType || "yearly";
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const quarter = parseInt(req.query.quarter) || 1;
    const month = parseInt(req.query.month) || 1;

    // Build employee query (same logic as getAllEmployees)
    const query = {};

    if (searchText.trim()) {
      query.$or = [
        { fullName: { $regex: searchText.trim(), $options: "i" } },
        { employeeID: { $regex: searchText.trim(), $options: "i" } },
        { cnic: { $regex: searchText.trim(), $options: "i" } },
      ];
    }

    if (statusFilter.trim()) {
      query.status = statusFilter.trim();
    }

    if (typeFilter.trim()) {
      query.employmentType = typeFilter.trim();
    }

    const positionQuery = {};
    if (departmentFilter.trim()) {
      positionQuery.department = departmentFilter.trim();
    }
    if (positionFilter.trim()) {
      positionQuery.name = positionFilter.trim();
    }

    if (Object.keys(positionQuery).length > 0) {
      const validPositionIds =
        await Position.find(positionQuery).distinct("_id");
      if (validPositionIds.length === 0) {
        query.position = new mongoose.Types.ObjectId();
      } else {
        query.position = { $in: validPositionIds };
      }
    }

    // Build date range for the time period
    let dateStart, dateEnd;
    if (periodType === "monthly") {
      dateStart = new Date(year, month - 1, 1);
      dateEnd = new Date(year, month, 1);
    } else if (periodType === "quarterly") {
      const quarterStartMonth = (quarter - 1) * 3;
      dateStart = new Date(year, quarterStartMonth, 1);
      dateEnd = new Date(year, quarterStartMonth + 3, 1);
    } else {
      dateStart = new Date(year, 0, 1);
      dateEnd = new Date(year + 1, 0, 1);
    }

    const skip = limit > 0 ? (page - 1) * limit : 0;
    const totalEmployees = await Employee.countDocuments(query);

    let employeesQuery = Employee.find(query)
      .populate({
        path: "position",
        select: "name department",
        populate: [{ path: "department", select: "name" }],
      })
      .sort({ createdAt: -1 });

    if (limit > 0) {
      employeesQuery = employeesQuery.skip(skip).limit(limit);
    }

    const employees = await employeesQuery.lean();
    const employeeIds = employees.map((emp) => emp._id);

    const CLOSED_STATUSES = [
      "Closed",
      "Closed (Early)",
      "Closed (On Time)",
      "Closed (Late)",
    ];

    // Aggregate work progress reports for these employees within date range
    const progressAggregation = await WorkProgressReport.aggregate([
      {
        $match: {
          employees: { $in: employeeIds },
          status: { $in: CLOSED_STATUSES },
          updatedAt: { $gte: dateStart, $lt: dateEnd },
        },
      },
      { $unwind: "$employees" },
      {
        $match: {
          employees: { $in: employeeIds },
        },
      },
      {
        $group: {
          _id: "$employees",
          tasksCompleted: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    const progressMap = new Map();
    for (const item of progressAggregation) {
      progressMap.set(item._id.toString(), {
        tasksCompleted: item.tasksCompleted,
        averageRating:
          item.averageRating != null
            ? Math.round(item.averageRating * 10) / 10
            : 0,
      });
    }

    const employeesWithProgress = employees.map((emp) => {
      const progress = progressMap.get(emp._id.toString());
      return {
        ...emp,
        tasksCompleted: progress?.tasksCompleted || 0,
        averageRating: progress?.averageRating || 0,
      };
    });

    res.json({
      employees: employeesWithProgress,
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

// ──────────────────────────────────────────────
// @description     Delete work progress report
// @route           DELETE /api/work-progress-reports/:id
// @access          Admin
// ──────────────────────────────────────────────
export const deleteWorkProgressReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Work Progress Report Not Found");
    }

    const report = await WorkProgressReport.findById(id)
      .populate("employees", "fullName employeeID")
      .lean();

    if (!report) {
      res.status(404);
      throw new Error("Work progress report not found");
    }

    await WorkProgressReport.findByIdAndDelete(id);

    res.json({
      message: "Work progress report deleted successfully",
      deletedReport: {
        id: report._id,
        employees: report.employees?.map((e) => e.fullName).join(", "),
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
