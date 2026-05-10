// React
import { useState } from "react";

// External
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

// Services
import {
  fetchEmployeeLeaveBalances,
  fetchEmployeeLeaveApplicationsList,
} from "@/services/employeesApi";
import { createLeaveApplication } from "@/services/leaveApplicationsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

// =============================================================================
// APPLY LEAVE DIALOG
// =============================================================================

const ApplyLeaveDialog = ({ open, onOpenChange, employee }) => {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");

  const leaveTypes = (employee.leaveEntitlements || [])
    .filter((entitlement) => entitlement.enabled && entitlement.leaveType)
    .map((entitlement) => entitlement.leaveType);

  const mutation = useMutation({
    mutationFn: createLeaveApplication,
    onSuccess: (data) => {
      toast.success(data?.message || "Leave application submitted");
      queryClient.invalidateQueries({
        queryKey: ["employee-leave-applications", employee._id],
      });
      queryClient.invalidateQueries({
        queryKey: ["employee-leave-balances", employee._id],
      });
      onOpenChange(false);
      setReason("");
      setLeaveTypeId("");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to submit application");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!leaveTypeId) {
      toast.error("Please select a leave type");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Please select date range");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date cannot be before start date");
      return;
    }
    const toIso = (d) => new Date(`${d}T00:00:00.000Z`).toISOString();
    mutation.mutate({
      employee: employee._id,
      leaveType: leaveTypeId,
      dateRanges: [
        { startDate: toIso(startDate), endDate: toIso(endDate) },
      ],
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply Leave</DialogTitle>
          <DialogDescription>For {employee.fullName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.dialogGrid}>
          <div className={styles.dialogFull}>
            <Label className="mb-1">Leave Type</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.length ? (
                  leaveTypes.map((lt) => (
                    <SelectItem key={lt._id} value={lt._id}>
                      {lt.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No enabled leave types
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label className="mb-1">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.dialogFull}>
            <Label className="mb-1">Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Optional reason"
            />
          </div>

          <DialogFooter className={styles.dialogFull}>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================================
// LEAVES TAB
// =============================================================================

const STATUS_VARIANT = {
  Pending: "secondary",
  Approved: "default",
  Rejected: "destructive",
};

const LeavesTab = ({ employee, canApply }) => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ["employee-leave-balances", employee._id],
    queryFn: () => fetchEmployeeLeaveBalances(employee._id),
  });

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: [
      "employee-leave-applications",
      employee._id,
      { page, status: statusFilter },
    ],
    queryFn: () =>
      fetchEmployeeLeaveApplicationsList(employee._id, {
        page,
        status: statusFilter,
      }),
  });

  // balancesData shape: { balancesByYear: { 2024: [...] } } or balances array — handle both
  const currentYear = new Date().getFullYear();
  const groupedBalances = balancesData?.balancesByYear || balancesData?.leaveBalances;
  const balances = Array.isArray(groupedBalances)
    ? groupedBalances
    : groupedBalances?.[currentYear] || balancesData?.balances || [];

  const applications = appsData?.applications || [];
  const totalPages = appsData?.pagination?.totalPages || 1;

  return (
    <div className={styles.sectionGroup}>
      <div>
        <div className={styles.sectionTitle}>Current Year Balances</div>
        {balancesLoading ? (
          <div className={styles.spinnerWrap}>
            <Spinner />
          </div>
        ) : balances.length === 0 ? (
          <div className={styles.empty}>No leave balances</div>
        ) : (
          <div className={styles.balanceGrid}>
            {balances.map((b) => (
              <div key={b._id || b.leaveType?._id} className={styles.balanceCard}>
                <div className={styles.balanceName}>
                  {b.leaveType?.name || "—"}
                </div>
                <div className={styles.balanceRow}>
                  <span>Total</span>
                  <span className={styles.balanceRowValue}>{b.totalDays}</span>
                </div>
                <div className={styles.balanceRow}>
                  <span>Used</span>
                  <span className={styles.balanceRowValue}>{b.usedDays}</span>
                </div>
                <div className={styles.balanceRow}>
                  <span>Remaining</span>
                  <span className={styles.balanceRowValue}>{b.remainingDays}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator className={styles.sectionDivider} />

      <div>
        <div className={styles.calendarToolbar}>
          <div className={styles.sectionTitle}>Leave Applications</div>
          <div className={styles.calendarToolbarSelectors}>
            <Select
              value={statusFilter || "all"}
              onValueChange={(v) => {
                setStatusFilter(v === "all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-35">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            {canApply ? (
              <Button onClick={() => setApplyOpen(true)}>
                <PlusIcon /> Apply Leave
              </Button>
            ) : null}
          </div>
        </div>

        {appsLoading ? (
          <div className={styles.spinnerWrap}>
            <Spinner />
          </div>
        ) : applications.length === 0 ? (
          <div className={styles.empty}>No leave applications</div>
        ) : (
          <>
            <table className={styles.subTable}>
              <thead>
                <tr>
                  <th>Applied</th>
                  <th>Leave Type</th>
                  <th>Days</th>
                  <th>Date Range</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a._id}>
                    <td>{formatDate(a.createdAt)}</td>
                    <td>{a.leaveType?.name || "—"}</td>
                    <td>{a.daysCount}</td>
                    <td>
                      {(a.dateRanges || [])
                        .map(
                          (r) =>
                            `${formatDate(r.startDate)} → ${formatDate(r.endDate)}`,
                        )
                        .join(", ") || "—"}
                    </td>
                    <td>
                      <Badge variant={STATUS_VARIANT[a.status] || "secondary"}>
                        {a.status}
                      </Badge>
                    </td>
                    <td>{a.reason || "—"}</td>
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
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
                    ),
                  )}
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

      {canApply ? (
        <ApplyLeaveDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          employee={employee}
        />
      ) : null}
    </div>
  );
};

export default LeavesTab;
