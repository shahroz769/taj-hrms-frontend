import { Outlet } from "react-router";
import Sidebar from "@/components/Sidebar/Sidebar";
import Header from "@/components/Header/Header";

const DashboardLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0">
        <Header className="shrink-0" />
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
