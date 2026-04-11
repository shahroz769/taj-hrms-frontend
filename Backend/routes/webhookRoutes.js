import express from "express";
import { receiveAttendanceWebhook } from "../controllers/webhookController.js";

const router = express.Router();

// @route   POST /api/webhook/attendance
// @access  Public (no auth — called by external device/service)
router.post("/attendance", receiveAttendanceWebhook);

export default router;
