import { ROLES } from "../../utils/roles";

export const sidebarItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    roles: [ROLES.admin, ROLES.supervisor],
  },
  {
    label: "Setups",
    roles: [ROLES.admin],
    children: [
      { label: "Departments Setup", path: "/setups/departments" },
      { label: "Positions Setup", path: "/setups/positions" },
      { label: "Shifts Setup", path: "/setups/shifts" },
    ],
  },
  {
    label: "Workforce",
    roles: [ROLES.admin, ROLES.supervisor],
    children: [
      { label: "All Employees", path: "/workforce/all-employees" },
      { label: "Shift Requests", path: "/workforce/shift-requests" },
      { label: "Shift Assignments", path: "/workforce/shift-assignments" },
      { label: "Contracts", path: "/workforce/contracts" },
    ],
  },
  {
    label: "Attendance",
    roles: [ROLES.admin, ROLES.supervisor],
    children: [{ label: "Attendance Records", path: "/attendance/records" }],
  },
  {
    label: "Leaves",
    roles: [ROLES.admin, ROLES.supervisor],
    children: [
      { label: "Leaves Types", path: "/leaves/types" },
      { label: "Leaves Applications", path: "/leaves/applications" },
    ],
  },
  {
    label: "Compliance",
    roles: [ROLES.admin, ROLES.supervisor],
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
