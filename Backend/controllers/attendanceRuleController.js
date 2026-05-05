import AttendanceRule from "../models/AttendanceRule.js";

const RULE_FIELDS = [
  "graceMinutes",
  "earlyCheckInMinutes",
  "absentAfterLateMinutes",
  "halfDayEarlyCheckOutMinutes",
  "lateCheckOutMinutes",
];

/**
 * Returns the singleton AttendanceRule document, creating it with defaults
 * the first time it is requested. Safe to call from anywhere on the server.
 */
export const getAttendanceRules = async () => {
  let rules = await AttendanceRule.findOne();
  if (!rules) {
    rules = await AttendanceRule.create({});
  }
  return rules;
};

// @description     Get the org-wide attendance rules
// @route           GET /api/attendance-rules
// @access          Admin
export const getAttendanceRulesHandler = async (req, res, next) => {
  try {
    const rules = await getAttendanceRules();
    res.json({ rules });
  } catch (err) {
    console.log(err);
    next(err);
  }
};

// @description     Update the org-wide attendance rules
// @route           PUT /api/attendance-rules
// @access          Admin
export const updateAttendanceRulesHandler = async (req, res, next) => {
  try {
    const updates = {};

    for (const field of RULE_FIELDS) {
      if (req.body?.[field] === undefined || req.body?.[field] === null) continue;
      const value = Number(req.body[field]);
      if (Number.isNaN(value) || value < 0) {
        res.status(400);
        throw new Error(`${field} must be a non-negative number`);
      }
      updates[field] = value;
    }

    if (
      updates.absentAfterLateMinutes !== undefined &&
      updates.graceMinutes !== undefined &&
      updates.absentAfterLateMinutes <= updates.graceMinutes
    ) {
      res.status(400);
      throw new Error(
        "Absent threshold must be greater than the grace period.",
      );
    }

    const existing = await getAttendanceRules();

    // Cross-field validation against the merged final state
    const merged = { ...existing.toObject(), ...updates };
    if (merged.absentAfterLateMinutes <= merged.graceMinutes) {
      res.status(400);
      throw new Error(
        "Absent threshold must be greater than the grace period.",
      );
    }

    Object.assign(existing, updates);
    if (req.user?._id) existing.updatedBy = req.user._id;
    await existing.save();

    res.json({
      message: "Attendance rules updated successfully",
      rules: existing,
    });
  } catch (err) {
    console.log(err);
    next(err);
  }
};
