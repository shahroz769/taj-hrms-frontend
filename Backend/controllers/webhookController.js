import TestAttendance from "../models/TestAttendance.js";

// @desc    Receive attendance webhook and save records
// @route   POST /api/webhook/attendance
// @access  Public
export const receiveAttendanceWebhook = async (req, res) => {
  // Respond 200 immediately so the caller doesn't time out
  res.status(200).json({ message: "Received" });

  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) return;

    const docs = records.map(({ userID, checkTime, attState }) => ({
      userID: String(userID),
      checkTime: new Date(checkTime),
      attState,
    }));

    await TestAttendance.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Webhook attendance save error:", err.message);
  }
};
