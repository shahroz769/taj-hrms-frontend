import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router";
import LoginPage from "./pages/auth/Login";
import { useDispatch } from "react-redux";
import { login, setAuthChecking } from "./redux/slices/authSlice";
import { refreshToken } from "./services/authApi";
import { useQuery } from "@tanstack/react-query";
import Dashboard from "./pages/Dashboard/Dashboard";
import DepartmentsSetups from "./pages/Setups/DepartmentsSetups";
import PositionsSetups from "./pages/Setups/PositionsSetups";
import ShiftsSetups from "./pages/Setups/ShiftsSetups";
import AllEmployees from "./pages/Workforce/AllEmployees";
import AddEmployee from "./pages/Workforce/AddEmployee";
import EditEmployee from "./pages/Workforce/EditEmployee";
import ShiftsRequests from "./pages/Workforce/ShiftsRequests";
import ShiftsAssignments from "./pages/Workforce/ShiftsAssignments";
import Contracts from "./pages/Workforce/Contracts";
import AttendanceRecords from "./pages/Attendance/AttendanceRecords";
import LeavesApplications from "./pages/Leaves/LeavesApplications";
import LeavesTypes from "./pages/Leaves/LeavesTypes";
import LeavesPolicies from "./pages/Leaves/LeavesPolicies";
import WorkProgressReports from "./pages/Compliance/WorkProgressReports";
import DisciplinaryActions from "./pages/Compliance/DisciplinaryActions";
import EmployeeProgressReports from "./pages/Compliance/EmployeeProgressReports";
import ProtectedRoute from "./auth/ProtectedRoute";
import { ROLES } from "./utils/roles";
import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";
import SalaryComponents from "./pages/Salary/SalaryComponents";
import SalaryPolicies from "./pages/Salary/SalaryPolicies";

function App() {
  const dispatch = useDispatch();

  useQuery({
    queryKey: ["refresh"],
    queryFn: async () => {
      try {
        // await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await refreshToken();
        dispatch(login(response.data));
        return response.data;
      } catch (error) {
        dispatch(setAuthChecking(false));
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              {/* Dashboard - accessible to admin and supervisor */}
              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[ROLES.admin, ROLES.supervisor]}
                  />
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
              </Route>

              {/* Setups */}
              <Route element={<ProtectedRoute allowedRoles={[ROLES.admin]} />}>
                <Route
                  path="/setups/departments"
                  element={<DepartmentsSetups />}
                />
                <Route path="/setups/positions" element={<PositionsSetups />} />
                <Route path="/setups/shifts" element={<ShiftsSetups />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={[ROLES.admin, ROLES.supervisor]}
                  />
                }
              >
                {/* Workforce */}
                <Route path="/workforce/employees" element={<AllEmployees />} />
                <Route
                  path="/workforce/employees/add"
                  element={<AddEmployee />}
                />
                <Route
                  path="/workforce/employees/:id/edit"
                  element={<EditEmployee />}
                />
                <Route
                  path="/workforce/shift-requests"
                  element={<ShiftsRequests />}
                />
                <Route
                  path="/workforce/shift-assignments"
                  element={<ShiftsAssignments />}
                />
                <Route path="/workforce/contracts" element={<Contracts />} />

                {/* Attendance */}
                <Route
                  path="/attendance/records"
                  element={<AttendanceRecords />}
                />

                {/* Leaves */}
                <Route path="/leaves/types" element={<LeavesTypes />} />
                <Route path="/leaves/policies" element={<LeavesPolicies />} />
                <Route
                  path="/leaves/applications"
                  element={<LeavesApplications />}
                />

                {/* Salary */}
                <Route
                  path="/salary/components"
                  element={<SalaryComponents />}
                />
                <Route path="/salary/policies" element={<SalaryPolicies />} />

                {/* Compliance */}
                <Route
                  path="/compliance/work-progress-reports"
                  element={<WorkProgressReports />}
                />
                <Route
                  path="/compliance/disciplinary-actions"
                  element={<DisciplinaryActions />}
                />
                <Route
                  path="/compliance/employee-progress-reports"
                  element={<EmployeeProgressReports />}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="bottom-right" />
    </>
  );
}
export default App;
