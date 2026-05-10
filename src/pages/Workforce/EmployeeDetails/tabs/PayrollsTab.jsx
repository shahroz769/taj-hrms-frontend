// React
import { useState } from "react";

// External
import { useQuery } from "@tanstack/react-query";

// Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployeePayrolls } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtMoney = (v) => `PKR ${Number(v || 0).toLocaleString()}`;

const PayrollsTab = ({ employeeId }) => {
  const [page, setPage] = useState(1);
  const [year, setYear] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-payrolls", employeeId, { page, year }],
    queryFn: () => fetchEmployeePayrolls(employeeId, { page, year }),
  });

  const payrolls = data?.payrolls || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const yearOptions = (() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - 4 + i);
  })();

  return (
    <div>
      <div className={styles.calendarToolbar}>
        <div className={styles.calendarToolbarSelectors}>
          <Select
            value={year || "all"}
            onValueChange={(v) => {
              setYear(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-35">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.spinnerWrap}>
          <Spinner />
        </div>
      ) : isError ? (
        <div className={styles.empty}>Failed to load payrolls</div>
      ) : payrolls.length === 0 ? (
        <div className={styles.empty}>No payroll records</div>
      ) : (
        <>
          <table className={styles.subTable}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Basic</th>
                <th>Allowances</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.map((p) => (
                <tr key={p._id}>
                  <td>{`${MONTHS[(p.month || 1) - 1]} ${p.year}`}</td>
                  <td>{fmtMoney(p.calculations?.basicSalaryAmount)}</td>
                  <td>{fmtMoney(p.calculations?.allowanceAmount)}</td>
                  <td>{fmtMoney(p.calculations?.grossSalary)}</td>
                  <td>{fmtMoney(p.calculations?.totalDeductions)}</td>
                  <td>
                    <strong>{fmtMoney(p.calculations?.netSalary)}</strong>
                  </td>
                  <td>
                    <Badge variant={p.isPaid ? "default" : "secondary"}>
                      {p.isPaid
                        ? `Paid${p.paidAt ? ` ${formatDate(p.paidAt)}` : ""}`
                        : "Unpaid"}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() =>
                        window.open(`/api/payrolls/${p._id}/payslip/pdf`, "_blank")
                      }
                    >
                      View Payslip
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 ? (
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(n);
                      }}
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}
    </div>
  );
};

export default PayrollsTab;
