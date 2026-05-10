// External
import { useQuery } from "@tanstack/react-query";

// Components
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployeeShiftHistory } from "@/services/employeeShiftsApi";

// Utils
import { formatDate, formatTimeToAMPM } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatWorkingDays = (workingDays) => {
  if (!workingDays || typeof workingDays !== "object") return "—";
  const enabled = DAY_LABELS.filter((d) => workingDays[d.toLowerCase()] || workingDays[d]);
  return enabled.length ? enabled.join(", ") : "—";
};

const ShiftHistoryTab = ({ employeeId }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-shift-history", employeeId],
    queryFn: () => fetchEmployeeShiftHistory(employeeId),
  });

  const history = data?.shiftHistory || [];

  if (isLoading) {
    return (
      <div className={styles.spinnerWrap}>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return <div className={styles.empty}>Failed to load shift history</div>;
  }

  if (history.length === 0) {
    return <div className={styles.empty}>No shift assignments recorded</div>;
  }

  return (
    <table className={styles.subTable}>
      <thead>
        <tr>
          <th>Effective Date</th>
          <th>Shift</th>
          <th>Timing</th>
          <th>Working Days</th>
          <th>Assigned By</th>
        </tr>
      </thead>
      <tbody>
        {history.map((h) => (
          <tr key={h._id}>
            <td>{h.effectiveDate ? formatDate(h.effectiveDate) : "—"}</td>
            <td>{h.shift?.name || "—"}</td>
            <td>
              {h.shift?.startTime && h.shift?.endTime
                ? `${formatTimeToAMPM(h.shift.startTime)} - ${formatTimeToAMPM(h.shift.endTime)}`
                : "—"}
            </td>
            <td>{formatWorkingDays(h.shift?.workingDays)}</td>
            <td>{h.assignedBy?.name || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ShiftHistoryTab;
