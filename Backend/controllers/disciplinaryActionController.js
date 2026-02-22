import DisciplinaryAction from "../models/DisciplinaryAction.js";
import Employee from "../models/Employee.js";
import WarningType from "../models/WarningType.js";
import mongoose from "mongoose";

// Helper: auto-expire actions past 90 days
const autoExpireActions = async (actions) => {
  const now = new Date();
  const bulkOps = [];

  for (const action of actions) {
    if (action.status === "Active") {
      const expiryDate = new Date(action.actionDate);
      expiryDate.setDate(expiryDate.getDate() + 90);
      if (now >= expiryDate) {
        bulkOps.push({
          updateOne: {
            filter: { _id: action._id },
            update: { $set: { status: "Inactive" } },
          },
        });
        action.status = "Inactive";
      }
    }
  }

  if (bulkOps.length > 0) {
    await DisciplinaryAction.bulkWrite(bulkOps);
  }

  return actions;
};

// @description     Get all disciplinary actions (paginated)
// @route           GET /api/disciplinary-actions
// @access          Admin, Supervisor
export const getAllDisciplinaryActions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchText = req.query.search || "";

    // Build search/filter pipeline
    const matchStage = {};

    const skip = (page - 1) * limit;

    // We need to search on employee name/ID, so use aggregation
    const pipeline = [
      {
        $lookup: {
          from: "employees",
          localField: "employee",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $lookup: {
          from: "warningtypes",
          localField: "warningType",
          foreignField: "_id",
          as: "warningType",
        },
      },
      { $unwind: "$warningType" },
    ];

    if (searchText.trim()) {
      pipeline.push({
        $match: {
          $or: [
            {
              "employee.fullName": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "employee.employeeID": {
                $regex: searchText.trim(),
                $options: "i",
              },
            },
            {
              "warningType.name": {
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
    const countResult = await DisciplinaryAction.aggregate(countPipeline);
    const totalActions = countResult[0]?.total || 0;

    // Fetch paginated
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });
    pipeline.push({
      $project: {
        _id: 1,
        "employee._id": 1,
        "employee.fullName": 1,
        "employee.employeeID": 1,
        "warningType._id": 1,
        "warningType.name": 1,
        "warningType.severity": 1,
        description: 1,
        actionDate: 1,
        status: 1,
        createdBy: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    });

    let actions = await DisciplinaryAction.aggregate(pipeline);

    // Auto-expire past 90-day actions
    const now = new Date();
    const bulkOps = [];

    actions = actions.map((action) => {
      const expiryDate = new Date(action.actionDate);
      expiryDate.setDate(expiryDate.getDate() + 90);
      const diffMs = expiryDate - now;
      const remainingDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      if (action.status === "Active" && remainingDays === 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: action._id },
            update: { $set: { status: "Inactive" } },
          },
        });
        action.status = "Inactive";
      }

      action.remainingDays = remainingDays;
      return action;
    });

    if (bulkOps.length > 0) {
      await DisciplinaryAction.bulkWrite(bulkOps);
    }

    res.json({
      disciplinaryActions: actions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalActions / limit),
        totalActions,
        limit,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Get disciplinary action by ID
// @route           GET /api/disciplinary-actions/:id
// @access          Admin, Supervisor
export const getDisciplinaryActionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Disciplinary Action Not Found");
    }

    const action = await DisciplinaryAction.findById(id)
      .populate("employee", "fullName employeeID")
      .populate("warningType", "name severity");

    if (!action) {
      res.status(404);
      throw new Error("Disciplinary action not found");
    }

    res.json(action);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Create new disciplinary action
// @route           POST /api/disciplinary-actions
// @access          Admin, Supervisor
export const createDisciplinaryAction = async (req, res, next) => {
  try {
    const { employee, warningType, description, actionDate } = req.body || {};

    if (!employee) {
      res.status(400);
      throw new Error("Employee is required");
    }

    if (!mongoose.Types.ObjectId.isValid(employee)) {
      res.status(400);
      throw new Error("Invalid employee ID");
    }

    const employeeDoc = await Employee.findById(employee);
    if (!employeeDoc) {
      res.status(404);
      throw new Error("Employee not found");
    }

    if (!warningType) {
      res.status(400);
      throw new Error("Warning type is required");
    }

    if (!mongoose.Types.ObjectId.isValid(warningType)) {
      res.status(400);
      throw new Error("Invalid warning type ID");
    }

    const warningTypeDoc = await WarningType.findById(warningType);
    if (!warningTypeDoc) {
      res.status(404);
      throw new Error("Warning type not found");
    }

    if (!description?.trim()) {
      res.status(400);
      throw new Error("Description is required");
    }

    if (!actionDate) {
      res.status(400);
      throw new Error("Action date is required");
    }

    const newAction = new DisciplinaryAction({
      employee,
      warningType,
      description: description.trim(),
      actionDate: new Date(actionDate),
      status: "Active",
      createdBy: req.user.name || req.user._id,
    });

    const savedAction = await newAction.save();

    const populatedAction = await DisciplinaryAction.findById(savedAction._id)
      .populate("employee", "fullName employeeID")
      .populate("warningType", "name severity");

    res.status(201).json(populatedAction);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update disciplinary action
// @route           PUT /api/disciplinary-actions/:id
// @access          Admin
export const updateDisciplinaryAction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Disciplinary Action Not Found");
    }

    const action = await DisciplinaryAction.findById(id);
    if (!action) {
      res.status(404);
      throw new Error("Disciplinary action not found");
    }

    const { employee, warningType, description, actionDate } = req.body || {};

    if (employee) {
      if (!mongoose.Types.ObjectId.isValid(employee)) {
        res.status(400);
        throw new Error("Invalid employee ID");
      }
      const employeeDoc = await Employee.findById(employee);
      if (!employeeDoc) {
        res.status(404);
        throw new Error("Employee not found");
      }
      action.employee = employee;
    }

    if (warningType) {
      if (!mongoose.Types.ObjectId.isValid(warningType)) {
        res.status(400);
        throw new Error("Invalid warning type ID");
      }
      const warningTypeDoc = await WarningType.findById(warningType);
      if (!warningTypeDoc) {
        res.status(404);
        throw new Error("Warning type not found");
      }
      action.warningType = warningType;
    }

    if (description !== undefined) {
      if (!description?.trim()) {
        res.status(400);
        throw new Error("Description is required");
      }
      action.description = description.trim();
    }

    if (actionDate) {
      action.actionDate = new Date(actionDate);
      // Recalculate status when date changes
      const expiryDate = new Date(action.actionDate);
      expiryDate.setDate(expiryDate.getDate() + 90);
      action.status = new Date() >= expiryDate ? "Inactive" : "Active";
    }

    const updatedAction = await action.save();

    const populatedAction = await DisciplinaryAction.findById(updatedAction._id)
      .populate("employee", "fullName employeeID")
      .populate("warningType", "name severity");

    res.json(populatedAction);
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Toggle disciplinary action status (Active/Inactive)
// @route           PATCH /api/disciplinary-actions/:id/status
// @access          Admin
export const toggleDisciplinaryActionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Disciplinary Action Not Found");
    }

    const action = await DisciplinaryAction.findById(id);
    if (!action) {
      res.status(404);
      throw new Error("Disciplinary action not found");
    }

    // Automatically toggle between Active and Inactive
    action.status = action.status === "Active" ? "Inactive" : "Active";
    const updatedAction = await action.save();

    const populatedAction = await DisciplinaryAction.findById(updatedAction._id)
      .populate("employee", "fullName employeeID")
      .populate("warningType", "name severity");

    res.json({
      message: `Disciplinary action ${action.status === "Active" ? "activated" : "deactivated"} successfully`,
      disciplinaryAction: populatedAction,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Delete disciplinary action
// @route           DELETE /api/disciplinary-actions/:id
// @access          Admin
export const deleteDisciplinaryAction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404);
      throw new Error("Disciplinary Action Not Found");
    }

    const action = await DisciplinaryAction.findById(id)
      .populate("employee", "fullName employeeID")
      .populate("warningType", "name");

    if (!action) {
      res.status(404);
      throw new Error("Disciplinary action not found");
    }

    await action.deleteOne();

    res.json({
      message: "Disciplinary action deleted successfully",
      deletedAction: {
        id: action._id,
        employee: action.employee?.fullName,
        warningType: action.warningType?.name,
      },
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
