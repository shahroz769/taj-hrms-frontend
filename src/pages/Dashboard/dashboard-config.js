import ArrowRightIcon from "lucide-react/dist/esm/icons/arrow-right";
import BriefcaseBusinessIcon from "lucide-react/dist/esm/icons/briefcase-business";
import CalendarCheckIcon from "lucide-react/dist/esm/icons/calendar-check";
import CircleDollarSignIcon from "lucide-react/dist/esm/icons/circle-dollar-sign";
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list";
import Clock3Icon from "lucide-react/dist/esm/icons/clock-3";
import IdCardLanyardIcon from "lucide-react/dist/esm/icons/id-card";
import LayoutGridIcon from "lucide-react/dist/esm/icons/layout-grid";
import MessageSquareWarningIcon from "lucide-react/dist/esm/icons/message-square-warning";
import ShieldAlertIcon from "lucide-react/dist/esm/icons/shield-alert";
import TrendingUpIcon from "lucide-react/dist/esm/icons/trending-up";
import TrophyIcon from "lucide-react/dist/esm/icons/trophy";
import TriangleAlertIcon from "lucide-react/dist/esm/icons/triangle-alert";

const currentDate = new Date();

export const CURRENT_YEAR = currentDate.getFullYear();
export const CURRENT_MONTH = currentDate.getMonth() + 1;
export const CURRENT_QUARTER = Math.ceil(CURRENT_MONTH / 3);
export const YEARS = Array.from(
  { length: 5 },
  (_, index) => String(CURRENT_YEAR - 2 + index),
);
export const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];
export const QUARTERS = [
  { value: "1", label: "Q1" },
  { value: "2", label: "Q2" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
];
export const ATTENDANCE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "color-mix(in oklch, var(--color-primary) 28%, white)",
];

export const EMPLOYMENT_COLORS = [
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
];

export const SEVERITY_COLORS = {
  Low: "var(--color-chart-2)",
  Medium: "var(--color-chart-4)",
  High: "var(--destructive)",
};

export const PROGRESS_COLORS = {
  Pending: "var(--color-chart-4)",
  "In Progress": "var(--color-chart-2)",
  Completed: "var(--color-chart-1)",
  Closed: "var(--muted-foreground)",
};

export const ICONS = {
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CalendarCheckIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  Clock3Icon,
  IdCardLanyardIcon,
  LayoutGridIcon,
  MessageSquareWarningIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
  TrophyIcon,
  TriangleAlertIcon,
};

export const quickActions = [
  {
    title: "Review attendance",
    description: "Jump into the monthly attendance grid and fix missing records.",
    href: "/attendance/records",
    icon: ClipboardListIcon,
  },
  {
    title: "Approve leave requests",
    description: "Open leave applications and process pending decisions.",
    href: "/leaves/applications",
    icon: CalendarCheckIcon,
  },
  {
    title: "Open payroll",
    description: "Check this period's payroll generation and payslip activity.",
    href: "/salary/payroll",
    icon: CircleDollarSignIcon,
  },
  {
    title: "Review compliance",
    description: "Inspect warnings, disciplinary actions, and work progress.",
    href: "/compliance/disciplinary-actions",
    icon: MessageSquareWarningIcon,
  },
  {
    title: "Manage contracts",
    description: "Open workforce contracts and check upcoming expiries.",
    href: "/workforce/contracts",
    icon: BriefcaseBusinessIcon,
  },
  {
    title: "Open progress reports",
    description: "Track employee work progress and follow up on delivery status.",
    href: "/compliance/employee-progress-reports",
    icon: TrendingUpIcon,
  },
];

export const attendanceChartConfig = {
  present: { label: "Present", color: ATTENDANCE_COLORS[0] },
  late: { label: "Late", color: ATTENDANCE_COLORS[1] },
  absent: { label: "Absent", color: ATTENDANCE_COLORS[2] },
  leave: { label: "Leave", color: ATTENDANCE_COLORS[3] },
  halfDay: { label: "Half Day", color: ATTENDANCE_COLORS[4] },
  off: { label: "Off", color: ATTENDANCE_COLORS[5] },
};

export const ATTENDANCE_STACK_KEYS = [
  { key: "present", color: ATTENDANCE_COLORS[0] },
  { key: "late", color: ATTENDANCE_COLORS[1] },
  { key: "absent", color: ATTENDANCE_COLORS[2] },
  { key: "leave", color: ATTENDANCE_COLORS[3] },
  { key: "halfDay", color: ATTENDANCE_COLORS[4] },
  { key: "off", color: ATTENDANCE_COLORS[5] },
];

export const workforceChartConfig = {
  Permanent: { label: "Permanent", color: EMPLOYMENT_COLORS[0] },
  Contract: { label: "Contract", color: EMPLOYMENT_COLORS[1] },
  "Part Time": { label: "Part Time", color: EMPLOYMENT_COLORS[2] },
};

export const payrollChartConfig = {
  gross: { label: "Gross", color: "var(--color-chart-1)" },
  net: { label: "Net", color: "var(--color-chart-2)" },
  deductions: { label: "Deductions", color: "var(--color-chart-4)" },
};

export const formatCurrency = (value) =>
  `PKR ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

export const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const roundRating = (value) => Number(value || 0).toFixed(1);

export const getItemVariant = (tone) => {
  if (tone === "destructive") return "destructive";
  if (tone === "warning") return "secondary";
  return "outline";
};

export const getQuarterMonthValues = (quarter) => {
  const normalizedQuarter = Number(quarter || 1);
  const startMonth = (normalizedQuarter - 1) * 3 + 1;
  return [startMonth, startMonth + 1, startMonth + 2];
};

export const getMonthOptions = (monthValues) =>
  monthValues.map((value) => ({
    value: String(value),
    label: MONTHS.find((month) => month.value === String(value))?.label || String(value),
  }));

export const getWeekOptionsForMonth = (year, month) => {
  const firstDayOfMonth = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  const lastDayOfMonth = new Date(Date.UTC(Number(year), Number(month), 0));
  const firstDayWeekday = firstDayOfMonth.getUTCDay();
  const daysFromMonday = (firstDayWeekday + 6) % 7;
  const firstWeekStart = new Date(firstDayOfMonth);
  firstWeekStart.setUTCDate(firstWeekStart.getUTCDate() - daysFromMonday);
  const options = [];
  let week = 1;
  let weekStart = firstWeekStart;

  while (weekStart <= lastDayOfMonth) {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    options.push({
      value: String(week),
      label: `Week ${week} (${String(weekStart.getUTCDate()).padStart(2, "0")} ${MONTHS[weekStart.getUTCMonth()].label.slice(0, 3)} - ${String(weekEnd.getUTCDate()).padStart(2, "0")} ${MONTHS[weekEnd.getUTCMonth()].label.slice(0, 3)})`,
    });
    weekStart = new Date(weekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
    week += 1;
  }

  return options;
};
