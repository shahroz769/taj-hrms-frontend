// React
import { useState } from "react";

// External
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ArrowRightLeftIcon from "lucide-react/dist/esm/icons/arrow-right-left";
import { toast } from "sonner";

// Components
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

// Services
import {
  fetchEmployeePositionHistory,
  transferEmployeePosition,
} from "@/services/employeesApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsByDepartment } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

// Styles
import styles from "../EmployeeDetails.module.css";

// =============================================================================
// TRANSFER DIALOG (inline)
// =============================================================================

const TransferDialog = ({ open, onOpenChange, employee }) => {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: open,
  });

  const departmentList = departments?.departmentsList || departments || [];

  const { data: positionsData, isFetching: isFetchingPositions } = useQuery({
    queryKey: ["positionsByDepartment", departmentId],
    queryFn: () => fetchPositionsByDepartment(departmentId),
    enabled: open && !!departmentId,
  });

  const positions = positionsData?.positions || positionsData || [];

  const mutation = useMutation({
    mutationFn: (payload) => transferEmployeePosition(employee._id, payload),
    onSuccess: (data) => {
      toast.success(data?.message || "Position transferred successfully");
      queryClient.invalidateQueries({ queryKey: ["employee", employee._id] });
      queryClient.invalidateQueries({
        queryKey: ["employee-position-history", employee._id],
      });
      onOpenChange(false);
      setDepartmentId("");
      setPositionId("");
      setReason("");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to transfer position");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!positionId) {
      toast.error("Please select a new position");
      return;
    }
    if (positionId === employee.position?._id) {
      toast.error("Please select a different position");
      return;
    }
    mutation.mutate({
      newPosition: positionId,
      effectiveDate,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer Position</DialogTitle>
          <DialogDescription>
            Move {employee.fullName} to a new position. Salary changes can be made
            later from the Edit Employee page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.dialogGrid}>
          <div className={styles.dialogFull}>
            <Label className="mb-1">Department</Label>
            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v);
                setPositionId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departmentList.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.dialogFull}>
            <Label className="mb-1">New Position</Label>
            <Select
              value={positionId}
              onValueChange={setPositionId}
              disabled={!departmentId || isFetchingPositions}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    !departmentId
                      ? "Select department first"
                      : isFetchingPositions
                        ? "Loading positions..."
                        : "Select position"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.dialogFull}>
            <Label className="mb-1">Effective Date</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>

          <div className={styles.dialogFull}>
            <Label className="mb-1">Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional notes for the transfer"
              rows={3}
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
              {mutation.isPending ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// =============================================================================
// POSITION HISTORY TAB
// =============================================================================

const PositionHistoryTab = ({ employee, canManage }) => {
  const [transferOpen, setTransferOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-position-history", employee._id],
    queryFn: () => fetchEmployeePositionHistory(employee._id),
  });

  const history = data?.positionHistory || [];

  return (
    <div>
      {canManage ? (
        <div className={styles.tableActions}>
          <Button onClick={() => setTransferOpen(true)}>
            <ArrowRightLeftIcon /> Transfer Position
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className={styles.spinnerWrap}>
          <Spinner />
        </div>
      ) : isError ? (
        <div className={styles.empty}>Failed to load position history</div>
      ) : history.length === 0 ? (
        <div className={styles.empty}>No position changes recorded</div>
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
            {history.map((h) => (
              <tr key={h._id}>
                <td>{h.effectiveDate ? formatDate(h.effectiveDate) : "—"}</td>
                <td>{h.fromPosition?.name || "—"}</td>
                <td>{h.toPosition?.name || "—"}</td>
                <td>{h.changedBy?.name || "—"}</td>
                <td>{h.reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canManage ? (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          employee={employee}
        />
      ) : null}
    </div>
  );
};

export default PositionHistoryTab;
