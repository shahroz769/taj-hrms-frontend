import styles from "./Header.module.css";
import { useLocation, useNavigate } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { getBreadcrumbs } from "@/utils/breadcrumbUtils";
import { logout } from "@/redux/slices/authSlice";
import { logoutUser } from "@/services/authApi";
import { ChevronRightIcon, SearchIcon, CircleXIcon } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const Header = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const breadcrumbs = getBreadcrumbs(pathname);

  const firstInitial = user?.name?.charAt(0)?.toUpperCase() || "U";

  const logOut = async () => {
    await logoutUser();
    dispatch(logout());
    navigate("/login");
  };

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

      {/* User Profile Dropdown */}
      <div className={styles.profileSection}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={styles.profileInitials}>{firstInitial}</div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem className="p-0">
              <Button
                className="justify-start w-full h-4 px-2 py-4"
                variant="ghost"
                onClick={logOut}
              >
                Log Out
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p className={styles.profileName}>{user?.name ?? "User"}</p>
      </div>
    </div>
  );
};

export default Header;
