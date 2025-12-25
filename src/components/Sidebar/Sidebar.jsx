import { sidebarItems } from "./sidebarConfig";
import { useSelector } from "react-redux";
import styles from "./Sidebar.module.css";
import logo from "../../assets/taj-logo.png";
import { Link, useLocation } from "react-router";
import { useState, useMemo } from "react";

const Sidebar = () => {
  const role = useSelector((state) => state.auth.user?.role);
  const location = useLocation();
  
  const filteredSidebarItems = useMemo(() => 
    sidebarItems.filter((item) => item.roles.includes(role)),
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
                      location.pathname === item.path || (item.path === "/dashboard" && location.pathname === "/")
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
                    style={{ cursor: item.collapsible ? 'pointer' : 'default' }}
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
                            transform: openItems[index] ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease-in-out'
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {item.children && (
                  <div className={`${styles.subMenu} ${openItems[index] ? styles.subMenuOpen : styles.subMenuClosed}`}>
                    {item.children.map((subItem, subIndex) => (
                      <Link 
                        key={subIndex} 
                        to={subItem.path} 
                        className={`${styles.subMenuItem} ${location.pathname === subItem.path ? styles.subMenuItemActive : ''}`}
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
          <div className={styles.profileInitials}>
            <p>HM</p>
          </div>
          <p className={styles.profileName}>Hady Malik</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
