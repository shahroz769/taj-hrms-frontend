import { sidebarItems } from "./sidebarConfig";
import { useSelector } from "react-redux";
import styles from "./Sidebar.module.css";
import logo from "../../assets/taj-logo.png";
import { Link, useLocation, useNavigate } from "react-router";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserIcon } from "lucide-react";
import { logout } from "@/redux/slices/authSlice";
import { useDispatch } from "react-redux";
import { logoutUser } from "@/services/authApi";

const Sidebar = () => {
  const role = useSelector((state) => state.auth.user?.role);
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const firstInitial = user?.name?.charAt(0).toUpperCase() ?? "U";

  const logOut = async () => {
    await logoutUser();
    dispatch(logout());
    navigate("/login");
  };

  const filteredSidebarItems = useMemo(
    () => sidebarItems.filter((item) => item.roles.includes(role)),
    [role]
  );

  // Calculate initial open state based on current path
  const getInitialOpenItems = () => {
    const initialOpen = {};
    filteredSidebarItems.forEach((item, index) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) => child.path === location.pathname
        );
        if (hasActiveChild) {
          initialOpen[index] = true;
        }
      }
    });
    return initialOpen;
  };

  const [openItems, setOpenItems] = useState(getInitialOpenItems);

  const toggleItem = (index) => {
    setOpenItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <>
      <aside className={styles.sidebarParent}>
        <div className={styles.sidebarTop}>
          {/* Logo Section */}
          <div className={styles.logo}>
            <img src={logo} alt="Taj Logo" />
          </div>
          {/* Menu Section */}
          <div className={styles.menu}>
            {filteredSidebarItems.map((item, index) => (
              <div key={index} className={styles.menuItem}>
                {/* If item has a path (like Dashboard), make it a Link */}
                {item.path ? (
                  <Link
                    to={item.path}
                    className={`${styles.menuItemTitle} ${
                      location.pathname === item.path ||
                      (item.path === "/dashboard" && location.pathname === "/")
                        ? styles.menuItemTitleActive
                        : ""
                    }`}
                  >
                    <div className={styles.menuItemTitleLeft}>
                      {item.icon && <item.icon size={20} color="#344054" />}
                      <p className={styles.menuItemLabel}>{item.label}</p>
                    </div>
                  </Link>
                ) : (
                  <div
                    className={styles.menuItemTitle}
                    onClick={() => item.collapsible && toggleItem(index)}
                    style={{ cursor: item.collapsible ? "pointer" : "default" }}
                  >
                    <div className={styles.menuItemTitleLeft}>
                      {item.icon && <item.icon size={20} color="#344054" />}
                      <p className={styles.menuItemLabel}>{item.label}</p>
                    </div>
                    <div className={styles.menuItemTitleRight}>
                      {item.collapsible && (
                        <item.collapseIcon
                          size={20}
                          color="#344054"
                          style={{
                            transform: openItems[index]
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.3s ease-in-out",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {item.children && (
                  <div
                    className={`${styles.subMenu} ${
                      openItems[index]
                        ? styles.subMenuOpen
                        : styles.subMenuClosed
                    }`}
                  >
                    {item.children.map((subItem, subIndex) => (
                      <Link
                        key={subIndex}
                        to={subItem.path}
                        className={`${styles.subMenuItem} ${
                          location.pathname === subItem.path
                            ? styles.subMenuItemActive
                            : ""
                        }`}
                      >
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Section */}
        <div className={styles.footer}>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    className="relative flex items-center justify-center w-9 h-9 bg-[#e6eeea] rounded-full"
                  >
                    {firstInitial}
                  </Button>
                </div>
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
          </div>
          <p className={styles.profileName}>{user?.name ?? "User"}</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
