import { sidebarItems } from "@/components/Sidebar/sidebarConfig";

const MONTH_NAMES = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const formatBreadcrumbLabel = (parts, part, index) => {
  if (parts[0] === "salary" && parts[1] === "payroll" && index === 3) {
    const monthNumber = Number(part);
    return MONTH_NAMES[monthNumber] || part;
  }

  return part.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

export function getBreadcrumbs(currentPath) {
  let result = [];

  for (const item of sidebarItems) {
    if (item.path === currentPath) {
      result.push({ label: item.label, path: item.path });
      return result;
    }

    if (item.children) {
      const child = item.children.find((c) => c.path === currentPath);
      if (child) {
        result.push({ label: item.label, path: "#" }); // parent non-clickable
        result.push({ label: child.label, path: child.path });
        return result;
      }
    }
  }

  // Fallback
  const parts = currentPath.split("/").filter(Boolean);
  return parts.map((p, idx) => ({
    label: formatBreadcrumbLabel(parts, p, idx),
    path: "/" + parts.slice(0, idx + 1).join("/"),
  }));
}
