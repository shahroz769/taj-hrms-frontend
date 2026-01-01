export const formatDate = (date) => {
  if (!date) return "N/A";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "N/A";

  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear().toString();

  return `${day} ${month} ${year}`;
};

/**
 * Converts a 24-hour time string (HH:mm) to 12-hour AM/PM format
 * @param {string} time - Time in HH:mm format (e.g., "14:00")
 * @returns {string} Time in 12-hour AM/PM format (e.g., "2:00 PM")
 */
export const formatTimeToAMPM = (time) => {
  if (!time) return "N/A";

  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return "N/A";

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
};

/**
 * Calculates the duration between start and end times in hours
 * @param {string} startTime - Start time in HH:mm format
 * @param {string} endTime - End time in HH:mm format
 * @returns {number} Duration in hours
 */
export const calculateShiftHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;

  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  if (
    isNaN(startHours) ||
    isNaN(startMinutes) ||
    isNaN(endHours) ||
    isNaN(endMinutes)
  ) {
    return 0;
  }

  let startTotalMinutes = startHours * 60 + startMinutes;
  let endTotalMinutes = endHours * 60 + endMinutes;

  // Handle overnight shifts (end time is earlier than start time)
  if (endTotalMinutes <= startTotalMinutes) {
    endTotalMinutes += 24 * 60;
  }

  const durationMinutes = endTotalMinutes - startTotalMinutes;
  return Math.round(durationMinutes / 60);
};

/**
 * Converts working day names to single-letter initials
 * @param {string[]} workingDays - Array of day names (e.g., ["Mon", "Tue", "Wed"])
 * @returns {string} Comma-separated initials (e.g., "M,T,W")
 */
export const formatWorkingDaysInitials = (workingDays) => {
  if (!workingDays || !Array.isArray(workingDays) || workingDays.length === 0) {
    return "-";
  }

  const dayInitials = {
    Mon: "M",
    Tue: "T",
    Wed: "W",
    Thu: "T",
    Fri: "F",
    Sat: "S",
    Sun: "S",
  };

  return workingDays.map((day) => dayInitials[day] || day[0]).join(",");
};
