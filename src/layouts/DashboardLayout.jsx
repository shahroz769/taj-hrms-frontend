import { Outlet } from "react-router";
import Sidebar from "@/components/Sidebar/Sidebar";
import Header from "@/components/Header/Header";

const DashboardLayout = () => {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1">
        <Header />
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
