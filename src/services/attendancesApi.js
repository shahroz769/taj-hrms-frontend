import API from "./api";

/**
 * Bulk mark attendance for multiple employees on a single date.
 *
 * @param {Object} payload
 * @param {string[]} payload.employeeIds
 * @param {string} payload.date - attendance date in YYYY-MM-DD format
 * @param {string} [payload.fallbackShiftId]  - optional shift for employees without assigned shift
 * @param {boolean} payload.forceApplyShift   - override all employees' shifts with fallbackShiftId
 * @param {boolean} payload.overwrite         - overwrite existing records
 * @param {boolean} payload.markAllDaysPresent - mark Present even on off days for the selected date
 */
export const bulkMarkAttendance = async (payload) => {
  const res = await API.post("/api/attendances/bulk-mark", payload);
  return res.data;
};

/**
 * Fetch monthly attendance grid for the AttendanceRecords page.
 *
 * @param {Object} params
 * @param {number} params.year
 * @param {number} params.month  - 0-indexed
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.search]
 */
export const fetchMonthlyAttendance = async ({
  year,
  month,
  page = 1,
  limit = 10,
  search = "",
}) => {
  const res = await API.get("/api/attendances/monthly", {
    params: { year, month, page, limit, search },
  });
  return res.data;
};

/**
 * Get all attendance records for a specific employee in a given month.
 *
 * @param {string} employeeId
 * @param {Object} params
 * @param {number} params.year
 * @param {number} params.month - 0-indexed
 */
export const fetchEmployeeMonthlyAttendance = async (
  employeeId,
  { year, month },
) => {
  const res = await API.get(`/api/attendances/employee/${employeeId}`, {
    params: { year, month },
  });
  return res.data;
};

/**
 * Update a single attendance record (cell edit).
 *
 * @param {string} id - attendance record _id
 * @param {Object} payload
 * @param {string} [payload.status]
 * @param {string} [payload.shiftId]
 * @param {string} [payload.checkIn]  - ISO date string
 * @param {string} [payload.checkOut] - ISO date string
 * @param {number} [payload.lateDurationMinutes]
 */
export const updateAttendance = async (id, payload) => {
  const res = await API.put(`/api/attendances/${id}`, payload);
  return res.data;
};

/**
 * Create a single attendance record for an empty cell.
 *
 * @param {Object} payload
 * @param {string} payload.employeeId
 * @param {string} payload.date       - ISO date string (YYYY-MM-DD)
 * @param {string} payload.status
 * @param {string} [payload.shiftId]
 * @param {string} [payload.checkIn]
 * @param {string} [payload.checkOut]
 * @param {number} [payload.lateDurationMinutes]
 */
export const markSingleAttendance = async (payload) => {
  const res = await API.post("/api/attendances/mark-single", payload);
  return res.data;
};

/**
 * Delete a single attendance record.
 *
 * @param {string} id - attendance record _id
 */
export const deleteAttendance = async (id) => {
  const res = await API.delete(`/api/attendances/${id}`);
  return res.data;
};

/**
 * Get the cached monthly summary for an employee (for payroll).
 *
 * @param {string} employeeId
 * @param {number} year
 * @param {number} month - 0-indexed
 */
export const fetchEmployeeMonthlySummary = async (
  employeeId,
  year,
  month,
) => {
  const res = await API.get(`/api/attendances/summary/${employeeId}`, {
    params: { year, month },
  });
  return res.data;
};
