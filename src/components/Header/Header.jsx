import styles from "./Header.module.css";
import { useLocation } from "react-router";
import { getBreadcrumbs } from "@/utils/breadcrumbUtils";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";

const Header = () => {
  const { pathname } = useLocation();
  const breadcrumbs = getBreadcrumbs(pathname);
  console.log("Breadcrumbs:", breadcrumbs);

  return (
    <div className={styles.header}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        {breadcrumbs.map((crumb, index) => (
          <span
            key={index}
            className={`${styles.breadcrumbItem} ${
              index === breadcrumbs.length - 1
                ? styles.breadcrumbItemActive
                : ""
            }`}
          >
            {crumb.label}
            {index < breadcrumbs.length - 1 && (
              <ChevronRightIcon className={styles.chevronIcon} />
            )}
          </span>
        ))}
      </div>

      {/* Search */}
      <InputGroup className={styles.searchInput}>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};

export default Header;
