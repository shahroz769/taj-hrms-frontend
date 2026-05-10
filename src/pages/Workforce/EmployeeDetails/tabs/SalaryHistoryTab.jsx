// External
import { useQuery } from "@tanstack/react-query";

// Components
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployeeCompensationHistory } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

const fmtMoney = (v) => `PKR ${Number(v || 0).toLocaleString()}`;

const SalaryHistoryTab = ({ employeeId }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-compensation-history", employeeId],
    queryFn: () => fetchEmployeeCompensationHistory(employeeId),
  });

  if (isLoading) {
    return (
      <div className={styles.spinnerWrap}>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return <div className={styles.empty}>Failed to load salary history</div>;
  }

  const basicSalaryHistory = data?.basicSalaryHistory || [];
  const allowanceHistory = data?.allowanceHistory || [];

  return (
    <div className={styles.sectionGroup}>
      <div>
        <div className={styles.sectionTitle}>Basic Salary History</div>
        {basicSalaryHistory.length === 0 ? (
          <div className={styles.empty}>No basic salary changes recorded</div>
        ) : (
          <table className={styles.subTable}>
            <thead>
              <tr>
                <th>Effective Date</th>
                <th>Previous</th>
                <th>New</th>
                <th>Change</th>
                <th>Changed By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {basicSalaryHistory.map((h) => {
                const change =
                  (h.toBasicSalary || 0) - (h.fromBasicSalary || 0);
                return (
                  <tr key={h._id}>
                    <td>{h.effectiveDate ? formatDate(h.effectiveDate) : "—"}</td>
                    <td>{fmtMoney(h.fromBasicSalary)}</td>
                    <td>{fmtMoney(h.toBasicSalary)}</td>
                    <td
                      style={{
                        color: change >= 0 ? "#15803d" : "var(--destructive)",
                        fontWeight: 600,
                      }}
                    >
                      {change >= 0 ? "+" : ""}
                      {fmtMoney(change)}
                    </td>
                    <td>{h.changedBy?.name || "—"}</td>
                    <td>{h.reason || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Separator className={styles.sectionDivider} />

      <div>
        <div className={styles.sectionTitle}>Allowance History</div>
        {allowanceHistory.length === 0 ? (
          <div className={styles.empty}>No allowance changes recorded</div>
        ) : (
          <table className={styles.subTable}>
            <thead>
              <tr>
                <th>Effective Date</th>
                <th>From</th>
                <th>To</th>
                <th>Changed By</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {allowanceHistory.map((h) => {
                const fromTotal = (h.fromAllowances || []).reduce(
                  (sum, a) => sum + (a.enabled ? Number(a.amount || 0) : 0),
                  0,
                );
                const toTotal = (h.toAllowances || []).reduce(
                  (sum, a) => sum + (a.enabled ? Number(a.amount || 0) : 0),
                  0,
                );
                return (
                  <tr key={h._id}>
                    <td>{h.effectiveDate ? formatDate(h.effectiveDate) : "—"}</td>
                    <td>{fmtMoney(fromTotal)}</td>
                    <td>{fmtMoney(toTotal)}</td>
                    <td>{h.changedBy?.name || "—"}</td>
                    <td>{h.reason || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SalaryHistoryTab;
