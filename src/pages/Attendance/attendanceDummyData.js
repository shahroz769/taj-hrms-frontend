// =============================================================================
// DUMMY ATTENDANCE DATA
// 15 employees × 3 months (Dec 2025, Jan 2026, Feb 2026)
// Statuses: P (Present), A (Absent), L (Leave), Off (Off day - Fridays)
// =============================================================================

const employees = [
  { id: "EMP001", name: "Ahmed Hassan" },
  { id: "EMP002", name: "Fatima Al-Rashid" },
  { id: "EMP003", name: "Mohammed Qureshi" },
  { id: "EMP004", name: "Sara Khan" },
  { id: "EMP005", name: "Omar Siddiqui" },
  { id: "EMP006", name: "Aisha Patel" },
  { id: "EMP007", name: "Yusuf Rahman" },
  { id: "EMP008", name: "Nadia Begum" },
  { id: "EMP009", name: "Tariq Mahmood" },
  { id: "EMP010", name: "Hina Ashraf" },
  { id: "EMP011", name: "Bilal Farooq" },
  { id: "EMP012", name: "Zainab Ali" },
  { id: "EMP013", name: "Imran Sheikh" },
  { id: "EMP014", name: "Mariam Noor" },
  { id: "EMP015", name: "Khalid Raza" },
];

/**
 * Generate a deterministic but varied attendance status for a given employee
 * index and day. Fridays (day 5) are always "Off".
 */
const generateStatus = (empIndex, day, dayOfWeek) => {
  if (dayOfWeek === 5) return "Off"; // Friday

  // Use a simple hash-like approach for variety
  const seed = (empIndex * 31 + day * 7) % 100;

  if (seed < 70) return "P"; // 70% present
  if (seed < 85) return "A"; // 15% absent
  return "L"; // 15% leave
};

/**
 * Build attendance records for a specific month/year.
 * Returns an array of { employee, records: { [day]: status } }
 */
const buildMonthData = (year, month) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  return employees.map((emp, empIndex) => {
    const records = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay(); // 0=Sun, 5=Fri

      // Don't generate future attendance data
      if (date > today) {
        records[day] = null; // Future date — no data
        continue;
      }

      records[day] = generateStatus(empIndex, day, dayOfWeek);
    }

    return {
      employee: emp,
      records,
    };
  });
};

// Pre-build 3 months of data
const attendanceDataStore = {
  "2025-12": buildMonthData(2025, 11), // December 2025
  "2026-1": buildMonthData(2026, 0), // January 2026
  "2026-2": buildMonthData(2026, 1), // February 2026
};

/**
 * Fetch attendance data for a given month/year.
 * Simulates an API call with search and pagination.
 *
 * @param {Object} params
 * @param {number} params.year
 * @param {number} params.month - 0-indexed (0 = January)
 * @param {string} params.search - Search by name or ID
 * @param {number} params.page
 * @param {number} params.limit - 0 means all
 * @returns {{ data: Array, pagination: Object }}
 */
export const getAttendanceData = ({
  year,
  month,
  search = "",
  page = 1,
  limit = 10,
}) => {
  const key = `${year}-${month + 1}`;

  // If we have pre-built data use it, otherwise generate on the fly
  let data = attendanceDataStore[key] || buildMonthData(year, month);

  // Search filter
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    data = data.filter(
      (item) =>
        item.employee.name.toLowerCase().includes(q) ||
        item.employee.id.toLowerCase().includes(q),
    );
  }

  const totalItems = data.length;

  // Pagination
  if (limit > 0) {
    const startIndex = (page - 1) * limit;
    data = data.slice(startIndex, startIndex + limit);
  }

  const totalPages = limit > 0 ? Math.ceil(totalItems / limit) : 1;

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      limit,
    },
  };
};

/**
 * Get summary stats for a single employee's month.
 */
export const getMonthSummary = (records) => {
  const summary = { P: 0, A: 0, L: 0, Off: 0 };
  Object.values(records).forEach((status) => {
    if (status && summary[status] !== undefined) {
      summary[status]++;
    }
  });
  return summary;
};
