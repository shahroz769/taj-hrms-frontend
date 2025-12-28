import styles from "./Header.module.css";
import { useLocation } from "react-router";
import { getBreadcrumbs } from "@/utils/breadcrumbUtils";
import { ChevronRightIcon, SearchIcon, CircleXIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const Header = () => {
  const { pathname } = useLocation();
  const breadcrumbs = getBreadcrumbs(pathname);

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
      {/* <InputGroup className={styles.searchInput}>
        <InputGroupInput placeholder="Search..." />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupAddon
          align="inline-end"
          className="cursor-pointer hover:text-[#02542D]"
        >
          <CircleXIcon />
        </InputGroupAddon>
      </InputGroup> */}
    </div>
  );
};

export default Header;
