import { ROLES } from "../../utils/roles";
import {
  LayoutGridIcon,
  FileSlidersIcon,
  IdCardLanyardIcon,
  ClipboardClockIcon,
  CalendarCheckIcon,
  MessageSquareWarningIcon,
  ChevronDownIcon,
  CircleDollarSignIcon,
} from "lucide-react";

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
      { label: "All Employees", path: "/workforce/all-employees" },
      { label: "Shift Requests", path: "/workforce/shift-requests" },
      { label: "Shift Assignments", path: "/workforce/shift-assignments" },
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
