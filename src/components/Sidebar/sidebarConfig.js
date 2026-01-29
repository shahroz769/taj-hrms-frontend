import { ROLES } from "../../utils/roles";
import LayoutGridIcon from "lucide-react/dist/esm/icons/layout-grid";
import FileSlidersIcon from "lucide-react/dist/esm/icons/file-sliders";
import IdCardLanyardIcon from "lucide-react/dist/esm/icons/id-card";
import ClipboardClockIcon from "lucide-react/dist/esm/icons/clipboard-list";
import CalendarCheckIcon from "lucide-react/dist/esm/icons/calendar-check";
import MessageSquareWarningIcon from "lucide-react/dist/esm/icons/message-square-warning";
import ChevronDownIcon from "lucide-react/dist/esm/icons/chevron-down";
import CircleDollarSignIcon from "lucide-react/dist/esm/icons/circle-dollar-sign";

export const sidebarItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutGridIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: false,
  },
  {
    label: "Setups",
    icon: FileSlidersIcon,
    roles: [ROLES.admin],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [
      { label: "Departments Setup", path: "/setups/departments" },
      { label: "Positions Setup", path: "/setups/positions" },
      { label: "Shifts Setup", path: "/setups/shifts" },
    ],
  },
  {
    label: "Workforce",
    icon: IdCardLanyardIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [
      { label: "All Employees", path: "/workforce/employees" },
      // { label: "Shift Requests", path: "/workforce/shift-requests" },
      // { label: "Shift Assignments", path: "/workforce/shift-assignments" },
      { label: "Contracts", path: "/workforce/contracts" },
    ],
  },
  {
    label: "Attendance",
    icon: ClipboardClockIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [{ label: "Attendance Records", path: "/attendance/records" }],
  },
  {
    label: "Leaves",
    icon: CalendarCheckIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [
      { label: "Leaves Types", path: "/leaves/types" },
      { label: "Leaves Policies", path: "/leaves/policies" },
      { label: "Leaves Applications", path: "/leaves/applications" },
    ],
  },
  {
    label: "Salary",
    icon: CircleDollarSignIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [
      { label: "Salary Components", path: "/salary/components" },
      { label: "Salary Policies", path: "/salary/policies" },
    ],
  },
  {
    label: "Compliance",
    icon: MessageSquareWarningIcon,
    roles: [ROLES.admin, ROLES.supervisor],
    collapsible: true,
    collapseIcon: ChevronDownIcon,
    children: [
      {
        label: "Work Progress Reports",
        path: "/compliance/work-progress-reports",
      },
      {
        label: "Disciplinary Actions",
        path: "/compliance/disciplinary-actions",
      },
      {
        label: "Employee Progress Reports",
        path: "/compliance/employee-progress-reports",
      },
    ],
  },
];
