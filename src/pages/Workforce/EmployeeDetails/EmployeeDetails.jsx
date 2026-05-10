// React
import { useMemo, useState } from "react";

// React Router
import { Link, useNavigate, useParams } from "react-router";

// External
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left";
import LogOutIcon from "lucide-react/dist/esm/icons/log-out";
import RefreshCcwIcon from "lucide-react/dist/esm/icons/refresh-ccw";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";

// Components
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

// Pages (tabs + dialogs)
import DetailsTab from "./tabs/DetailsTab";
import PositionHistoryTab from "./tabs/PositionHistoryTab";
import ShiftHistoryTab from "./tabs/ShiftHistoryTab";
import AttendanceTab from "./tabs/AttendanceTab";
import LeavesTab from "./tabs/LeavesTab";
import SalaryHistoryTab from "./tabs/SalaryHistoryTab";
import PayrollsTab from "./tabs/PayrollsTab";
import EndEmploymentDialog from "./dialogs/EndEmploymentDialog";
import RejoinEmployeeDialog from "./dialogs/RejoinEmployeeDialog";

// Services
import { fetchEmployeeById } from "@/services/employeesApi";

// Utils
import { ROLES } from "@/utils/roles";
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "./EmployeeDetails.module.css";

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_BADGE_VARIANT = {
  Active: "default",
  Inactive: "secondary",
  Resigned: "outline",
  Terminated: "destructive",
};

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// =============================================================================
// COMPONENT
// =============================================================================

const EmployeeDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const role = useSelector((state) => state.auth.user?.role);
  const isAdmin = role === ROLES.admin;

  const [activeTab, setActiveTab] = useState("details");
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endDialogMode, setEndDialogMode] = useState("Terminated");
  const [rejoinDialogOpen, setRejoinDialogOpen] = useState(false);

  const {
    data: employeeResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => fetchEmployeeById(id),
    enabled: !!id,
  });

  const employee = useMemo(() => {
    if (!employeeResponse) return null;
    const base = employeeResponse.employee || employeeResponse;
    return {
      ...base,
      currentShift: employeeResponse.currentShift || base.currentShift || null,
    };
  }, [employeeResponse]);

  const previousLeavingNote = useMemo(() => {
    if (!employee?.employmentHistory?.length) return null;
    const last = employee.employmentHistory[employee.employmentHistory.length - 1];
    return last;
  }, [employee]);

  if (isLoading) {
    return (
      <div className={styles.spinnerWrap}>
        <Spinner />
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className={styles.container}>
        <Alert variant="destructive">
          <AlertTitle>Failed to load employee</AlertTitle>
          <AlertDescription>
            {error?.response?.data?.message || error?.message || "Employee not found"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const department = employee.position?.department?.name || "—";
  const positionName = employee.position?.name || "—";
  const isEnded = ["Resigned", "Terminated"].includes(employee.status);

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <Link to="/workforce/employees" className={styles.backLink}>
          <ArrowLeftIcon size={14} />
          Back to Employees
        </Link>
      </div>

      <div className={styles.profileCard}>
        <Avatar className="h-20 w-20">
          <AvatarImage src={employee.employeePicture || undefined} alt={employee.fullName} />
          <AvatarFallback>{getInitials(employee.fullName)}</AvatarFallback>
        </Avatar>

        <div className={styles.profileIdentity}>
          <span className={styles.profileName}>{employee.fullName}</span>
          <div className={styles.profileMeta}>
            <span>ID: {employee.employeeID || "—"}</span>
            <span>•</span>
            <span>{positionName}</span>
            <span>•</span>
            <span>{department}</span>
            {employee.joiningDate ? (
              <>
                <span>•</span>
                <span>Joined {formatDate(employee.joiningDate)}</span>
              </>
            ) : null}
          </div>
          <div className={styles.profileBadges}>
            <Badge variant={STATUS_BADGE_VARIANT[employee.status] || "secondary"}>
              {employee.status}
            </Badge>
            {employee.employmentType ? (
              <Badge variant="outline">{employee.employmentType}</Badge>
            ) : null}
            {employee.currentShift ? (
              <Badge variant="outline">Shift: {employee.currentShift.name}</Badge>
            ) : null}
          </div>
        </div>

        {isAdmin ? (
          <div className={styles.profileActions}>
            <Button
              variant="outline"
              onClick={() => navigate(`/workforce/employees/${employee._id}/edit`)}
            >
              <PencilIcon /> Edit
            </Button>
            {isEnded ? (
              <Button onClick={() => setRejoinDialogOpen(true)}>
                <RefreshCcwIcon /> Rejoin
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEndDialogMode("Resigned");
                    setEndDialogOpen(true);
                  }}
                >
                  Resign
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setEndDialogMode("Terminated");
                    setEndDialogOpen(true);
                  }}
                >
                  <LogOutIcon /> Terminate
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {isEnded && employee.resignationDate ? (
        <Alert>
          <AlertTitle>
            {employee.status === "Terminated" ? "Terminated" : "Resigned"} on{" "}
            {formatDate(employee.resignationDate)}
          </AlertTitle>
          {employee.resignationReason ? (
            <AlertDescription>Reason: {employee.resignationReason}</AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      {!isEnded && previousLeavingNote ? (
        <Alert>
          <AlertTitle>
            Previous {previousLeavingNote.status?.toLowerCase?.() || "leaving"} on{" "}
            {formatDate(previousLeavingNote.resignationDate)}
          </AlertTitle>
          {previousLeavingNote.resignationReason ? (
            <AlertDescription>
              Reason: {previousLeavingNote.resignationReason}
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={styles.tabsList}>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="position">Position History</TabsTrigger>
          <TabsTrigger value="shift">Shift History</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="salary">Salary History</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className={styles.tabContent}>
          <DetailsTab employee={employee} />
        </TabsContent>

        <TabsContent value="position" className={styles.tabContent}>
          <PositionHistoryTab employee={employee} canManage={isAdmin && !isEnded} />
        </TabsContent>

        <TabsContent value="shift" className={styles.tabContent}>
          <ShiftHistoryTab employeeId={employee._id} />
        </TabsContent>

        <TabsContent value="attendance" className={styles.tabContent}>
          <AttendanceTab employeeId={employee._id} />
        </TabsContent>

        <TabsContent value="leaves" className={styles.tabContent}>
          <LeavesTab employee={employee} canApply={isAdmin && !isEnded} />
        </TabsContent>

        <TabsContent value="salary" className={styles.tabContent}>
          <SalaryHistoryTab employeeId={employee._id} />
        </TabsContent>

        <TabsContent value="payroll" className={styles.tabContent}>
          <PayrollsTab employeeId={employee._id} />
        </TabsContent>
      </Tabs>

      {isAdmin ? (
        <>
          <EndEmploymentDialog
            open={endDialogOpen}
            onOpenChange={setEndDialogOpen}
            employee={employee}
            mode={endDialogMode}
          />
          <RejoinEmployeeDialog
            open={rejoinDialogOpen}
            onOpenChange={setRejoinDialogOpen}
            employee={employee}
          />
        </>
      ) : null}
    </div>
  );
};

export default EmployeeDetails;
