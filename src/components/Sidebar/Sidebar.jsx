import { sidebarItems } from "./sidebarConfig";
import { useSelector } from "react-redux";
import styles from "./Sidebar.module.css";
import logo from "../../assets/taj-logo.png";
import { Link, useLocation } from "react-router";
import { useState, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// import { Button } from "@/components/ui/button";
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// import { UserIcon } from "lucide-react";
// import { logout } from "@/redux/slices/authSlice";
// import { useDispatch } from "react-redux";
// import { logoutUser } from "@/services/authApi";

// Local storage key for sidebar state
const STORAGE_KEY = "sidebar-open-items";

// Helper function to load sidebar state from local storage
const loadFromLocalStorage = () => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (error) {
    console.error("Error loading sidebar state from local storage:", error);
  }
  return {};
};

// Helper function to save sidebar state to local storage
const saveToLocalStorage = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving sidebar state to local storage:", error);
  }
};

const Sidebar = () => {
  const role = useSelector((state) => state.auth.user?.role);
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const MotionSpan = motion.span;
  const MotionDiv = motion.div;
  // const dispatch = useDispatch();
  // const navigate = useNavigate();
  // const user = useSelector((state) => state.auth.user);
  // const firstInitial = user?.name?.charAt(0).toUpperCase() ?? "U";

  // const logOut = async () => {
  //   await logoutUser();
  //   dispatch(logout());
  //   navigate("/login");
  // };

  const filteredSidebarItems = useMemo(
    () => sidebarItems.filter((item) => item.roles.includes(role)),
    [role]
  );

  // Calculate initial open state based on current path and local storage
  const getInitialOpenItems = () => {
    const savedState = loadFromLocalStorage();

    const initialOpen = {};
    filteredSidebarItems.forEach((item, index) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) => child.path === location.pathname
        );
        if (hasActiveChild) {
          initialOpen[index] = true;
        } else if (Object.prototype.hasOwnProperty.call(savedState, index)) {
          initialOpen[index] = savedState[index];
        }
      }
    });
    return initialOpen;
  };

  const [openItems, setOpenItems] = useState(getInitialOpenItems);

  const submenuTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: "easeInOut" };

  const chevronTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: "easeInOut" };

  const toggleItem = (index) => {
    setOpenItems((prev) => {
      const newState = {
        ...prev,
        [index]: !prev[index],
      };
      saveToLocalStorage(newState);
      return newState;
    });
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
                        <MotionSpan
                          animate={{ rotate: openItems[index] ? 180 : 0 }}
                          transition={chevronTransition}
                          style={{ display: "inline-flex" }}
                        >
                          <item.collapseIcon size={20} color="#344054" />
                        </MotionSpan>
                      )}
                    </div>
                  </div>
                )}
                {item.children && (
                  <AnimatePresence initial={false}>
                    {openItems[index] && (
                      <MotionDiv
                        className={styles.subMenu}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={submenuTransition}
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
                      </MotionDiv>
                    )}
                  </AnimatePresence>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Section */}
        {/* <div className={styles.footer}>
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
        </div> */}
      </aside>
    </>
  );
};

export default Sidebar;
