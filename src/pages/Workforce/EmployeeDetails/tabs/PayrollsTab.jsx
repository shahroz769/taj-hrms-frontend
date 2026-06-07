// React
import { useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DownloadIcon from "lucide-react/dist/esm/icons/download";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import { toast } from "sonner";

// Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployeePayrolls } from "@/services/employeesApi";
import { downloadPayslipPdf, fetchPayslip } from "@/services/payrollApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";
import payrollStyles from "@/pages/Salary/Payroll.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtMoney = (v) => `PKR ${Number(v || 0).toLocaleString()}`;
const sumAmounts = (items = []) =>
  items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);

const PayrollsTab = ({ employeeId }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(() => Number(searchParams.get("payrollPage")) || 1);
  const [year, setYear] = useState(() => {
    const urlYear = searchParams.get("payrollYear");
    return urlYear && urlYear !== "all" ? urlYear : "";
  });
  const [selectedPayslipId, setSelectedPayslipId] = useState(null);
  const [payslipDialogOpen, setPayslipDialogOpen] = useState(false);
  const [openingPayslipId, setOpeningPayslipId] = useState(null);
  const [isDownloadingPayslip, setIsDownloadingPayslip] = useState(false);

  const updatePayrollUrl = (nextPage, nextYear) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "payroll");
      next.set("payrollPage", String(nextPage));
      next.set("payrollYear", nextYear || "all");
      return next;
    }, { replace: true });
  };

  const setPayrollPage = (nextPage) => {
    setPage(nextPage);
    updatePayrollUrl(nextPage, year);
  };

  const setPayrollYear = (nextYear) => {
    setYear(nextYear);
    setPage(1);
    updatePayrollUrl(1, nextYear);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-payrolls", employeeId, { page, year }],
    queryFn: () => fetchEmployeePayrolls(employeeId, { page, year }),
  });

  const payrolls = data?.payrolls || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const { data: payslipData, isLoading: isPayslipLoading } = useQuery({
    queryKey: ["payslip", selectedPayslipId],
    queryFn: () => fetchPayslip(selectedPayslipId),
    enabled: Boolean(selectedPayslipId) && payslipDialogOpen,
  });

  const payslip = payslipData?.payslip;
  const fullAllowanceAmount =
    sumAmounts(payslip?.allowanceBreakdown || []) ||
    Number(payslip?.calculations?.fullAllowanceAmount || 0) ||
    Number(payslip?.calculations?.allowanceAmount || 0);
  const fullBasicSalaryAmount =
    Number(payslip?.employeeSnapshot?.basicSalary || 0) ||
    Number(payslip?.calculations?.fullBasicSalaryAmount || 0) ||
    Number(payslip?.calculations?.basicSalaryAmount || 0);
  const presentCount =
    Number(payslip?.workingDays?.present || 0) +
    Number(payslip?.workingDays?.late || 0) +
    Number(payslip?.workingDays?.halfDay || 0);

  const openPayslip = async (payroll) => {
    const payrollId = payroll?._id;
    if (!payrollId || openingPayslipId) return;

    setOpeningPayslipId(payrollId);
    try {
      await queryClient.fetchQuery({
        queryKey: ["payslip", payrollId],
        queryFn: () => fetchPayslip(payrollId),
      });
      setSelectedPayslipId(payrollId);
      setPayslipDialogOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load payslip");
    } finally {
      setOpeningPayslipId(null);
    }
  };

  const handleDownloadPayslip = async () => {
    if (!selectedPayslipId || isDownloadingPayslip) return;

    try {
      setIsDownloadingPayslip(true);
      const blob = await downloadPayslipPdf(selectedPayslipId);
      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `payslip-${selectedPayslipId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to download payslip");
    } finally {
      setIsDownloadingPayslip(false);
    }
  };

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
              setPayrollYear(v === "all" ? "" : v);
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
                      variant="outline"
                      size="sm"
                      onClick={() => openPayslip(p)}
                      disabled={openingPayslipId === p._id}
                    >
                      {openingPayslipId === p._id ? <Spinner /> : <EyeIcon />}
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
                      setPayrollPage(Math.max(1, page - 1));
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      isActive={n === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPayrollPage(n);
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
                      setPayrollPage(Math.min(totalPages, page + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </>
      )}

      <Dialog
        open={payslipDialogOpen}
        onOpenChange={(open) => {
          setPayslipDialogOpen(open);
          if (!open) setSelectedPayslipId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader>
            <div className="px-6 pt-6">
              <DialogTitle>Payslip</DialogTitle>
              <DialogDescription>
                {payslip ? `${MONTHS[(payslip.month || 1) - 1]} ${payslip.year}` : "Payroll details"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <ScrollArea className={payrollStyles.payslipScrollArea}>
            {isPayslipLoading ? (
              <div className={payrollStyles.payslipLoadingWrap}>
                <Spinner /> Loading payslip...
              </div>
            ) : (
              <div className={payrollStyles.payslipContent}>
                <div className={payrollStyles.payslipInfoGrid}>
                  <div className={payrollStyles.payslipInfoGroup}>
                    <div className={payrollStyles.payslipInfoLabel}>Employee</div>
                    <div className={payrollStyles.payslipInfoValue}>
                      {payslip?.employeeSnapshot?.fullName || "-"} ({payslip?.employeeSnapshot?.employeeID || "-"})
                    </div>
                  </div>
                  <div className={payrollStyles.payslipInfoGroup}>
                    <div className={payrollStyles.payslipInfoLabel}>Position</div>
                    <div className={payrollStyles.payslipInfoValue}>
                      {payslip?.employeeSnapshot?.positionName || "-"}
                    </div>
                  </div>
                  <div className={payrollStyles.payslipInfoGroup}>
                    <div className={payrollStyles.payslipInfoLabel}>Department</div>
                    <div className={payrollStyles.payslipInfoValue}>
                      {payslip?.employeeSnapshot?.departmentName || "-"}
                    </div>
                  </div>
                  <div className={payrollStyles.payslipInfoGroup}>
                    <div className={payrollStyles.payslipInfoLabel}>Net Salary</div>
                    <div className={payrollStyles.payslipInfoValue}>
                      {fmtMoney(payslip?.calculations?.netSalary || payslip?.calculations?.totalSalary)}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className={payrollStyles.payslipSectionTitle}>Attendance</div>
                <div className={payrollStyles.payslipAttendanceGrid}>
                  <div className={payrollStyles.payslipAttendanceStat}>
                    <div className={payrollStyles.payslipStatValue}>{payslip?.workingDays?.totalScheduled ?? 0}</div>
                    <div className={payrollStyles.payslipStatLabel}>Working Days</div>
                  </div>
                  <div className={payrollStyles.payslipAttendanceStat}>
                    <div className={payrollStyles.payslipStatValue}>{presentCount}</div>
                    <div className={payrollStyles.payslipStatLabel}>Present</div>
                  </div>
                  <div className={payrollStyles.payslipAttendanceStat}>
                    <div className={payrollStyles.payslipStatValue}>{payslip?.workingDays?.leaves ?? 0}</div>
                    <div className={payrollStyles.payslipStatLabel}>Leave</div>
                  </div>
                  <div className={payrollStyles.payslipAttendanceStat}>
                    <div className={payrollStyles.payslipStatValue}>{payslip?.workingDays?.absences ?? 0}</div>
                    <div className={payrollStyles.payslipStatLabel}>Absent</div>
                  </div>
                </div>

                <Separator />

                <div className={payrollStyles.payslipSectionTitle}>Salary</div>
                <div className={payrollStyles.payslipBreakdownWrap}>
                  <div className={payrollStyles.payslipBreakdownRow}>
                    <span className={payrollStyles.payslipBreakdownLabel}>Basic Salary</span>
                    <span className={payrollStyles.payslipBreakdownAmount}>{fmtMoney(fullBasicSalaryAmount)}</span>
                  </div>
                  {(payslip?.allowanceBreakdown || []).map((item, index) => (
                    <div key={`${item.name}-${index}`} className={payrollStyles.payslipAllowanceRow}>
                      <span className={payrollStyles.payslipAllowanceName}>{item.name}</span>
                      <span className={payrollStyles.payslipAllowanceAmount}>{fmtMoney(item.amount)}</span>
                    </div>
                  ))}
                  <div className={payrollStyles.payslipAllowanceTotalRow}>
                    <span>Total Allowances</span>
                    <span>{fmtMoney(fullAllowanceAmount)}</span>
                  </div>
                  <div className={payrollStyles.payslipTotalRow}>
                    <span>Net Salary</span>
                    <span className={payrollStyles.payslipTotalAmount}>
                      {fmtMoney(payslip?.calculations?.netSalary || payslip?.calculations?.totalSalary)}
                    </span>
                  </div>
                </div>

                <DialogFooter className={payrollStyles.payslipFooter}>
                  <Button
                    variant="green"
                    onClick={handleDownloadPayslip}
                    disabled={isDownloadingPayslip || !selectedPayslipId}
                  >
                    {isDownloadingPayslip ? <Spinner /> : <DownloadIcon />}
                    Download PDF
                  </Button>
                </DialogFooter>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PayrollsTab;
