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
import { Textarea } from "@/components/ui/textarea";

// Services
import { endEmployeeEmployment } from "@/services/employeesApi";

// Styles
import styles from "../EmployeeDetails.module.css";

const EndEmploymentDialog = ({ open, onOpenChange, employee, mode }) => {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState("");

  const isTermination = mode === "Terminated";
  const titleVerb = isTermination ? "Terminate" : "Resign";
  const dateLabel = isTermination ? "Termination Date" : "Resignation Effective Date";

  const mutation = useMutation({
    mutationFn: (payload) => endEmployeeEmployment(employee._id, payload),
    onSuccess: (data) => {
      toast.success(data?.message || "Employment ended");
      queryClient.invalidateQueries({ queryKey: ["employee", employee._id] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Failed to end employment");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!effectiveDate) {
      toast.error(`${dateLabel} is required`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    mutation.mutate({
      effectiveDate,
      reason: reason.trim(),
      mode,
    });
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      setEffectiveDate(today);
      setReason("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleVerb} Employee</DialogTitle>
          <DialogDescription>
            {titleVerb} {employee.fullName} ({employee.employeeID || "—"}). The
            payroll calculations will use this as the final eligible employment date.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className={styles.dialogGrid}>
          <div className={styles.dialogFull}>
            <Label className="mb-1">{dateLabel}</Label>
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
              rows={4}
              placeholder={`Why is this employee being ${isTermination ? "terminated" : "resigned"}?`}
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
            <Button
              type="submit"
              variant={isTermination ? "destructive" : "default"}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : `Confirm ${titleVerb}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EndEmploymentDialog;
