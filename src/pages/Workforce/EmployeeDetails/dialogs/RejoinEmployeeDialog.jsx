// React
import { useState } from "react";

// External
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

// Services
import { rejoinEmployee } from "@/services/employeesApi";

// Styles
import styles from "../EmployeeDetails.module.css";

const RejoinEmployeeDialog = ({ open, onOpenChange, employee }) => {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [joiningDate, setJoiningDate] = useState(today);
  const previousLeavingLabel = employee.resignationDate
    ? `${employee.status?.toLowerCase?.() || "left"} on ${new Date(
        employee.resignationDate,
      ).toLocaleDateString()}`
    : null;

  const mutation = useMutation({
    mutationFn: (payload) => rejoinEmployee(employee._id, payload),
    onSuccess: (data) => {
      toast.success(data?.message || "Employee rejoined successfully");
      queryClient.invalidateQueries({ queryKey: ["employee", employee._id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({
        queryKey: ["employee-leave-balances", employee._id],
      });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to rejoin employee");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!joiningDate) {
      toast.error("Rejoining date is required");
      return;
    }
    mutation.mutate({ joiningDate });
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setJoiningDate(today);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rejoin Employee</DialogTitle>
          <DialogDescription>
            Reactivate {employee.fullName} ({employee.employeeID || "—"}). The
            {previousLeavingLabel
              ? `Previous record: ${previousLeavingLabel}${
                  employee.resignationReason ? `, ${employee.resignationReason}` : ""
                }. `
              : ""}
            Employee ID and previous position history will be retained. Current
            year leave balances will be reset based on entitlements.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.dialogGrid}>
          <div className={styles.dialogFull}>
            <Label className="mb-1">Rejoining Date</Label>
            <Input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              required
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
              {mutation.isPending ? "Saving..." : "Confirm Rejoin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RejoinEmployeeDialog;
