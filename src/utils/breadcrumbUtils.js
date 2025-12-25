import { sidebarItems } from "@/components/Sidebar/sidebarConfig";

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
    label: p.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    path: "/" + parts.slice(0, idx + 1).join("/"),
  }));
}
