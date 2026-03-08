// React
import { useCallback, useState } from "react";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services
import {
  updateAttendance,
  markSingleAttendance,
  deleteAttendance,
} from "@/services/attendancesApi";
import { fetchShiftsList } from "@/services/employeeShiftsApi";

// Utils
import { formatDate, formatTimeToAMPM } from "@/utils/dateUtils";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a "HH:MM" string from a Date object.
 */
const toTimeStr = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

/**
 * Combine a date (YYYY-MM-DD) with a time string (HH:MM) into an ISO string.
 */
const combineDateAndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  return `${dateStr}T${timeStr}:00.000Z`;
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * AttendanceCellEditModal
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - employeeName: string
 *  - date: Date — the date of the cell
 *  - record: object | null | undefined
 *    - null/undefined: empty cell → POST create
 *    - object: existing record → PUT update
 *  - onSuccess: () => void — invalidate queries or refetch
 */
const AttendanceCellEditModal = ({
  open,
  onOpenChange,
  employeeName,
  employeeId,
  date,
  dateStr,
  record,
  preloadedShift,
}) => {
  const queryClient = useQueryClient();

  const isNewRecord = !record?._id;

  // ---------------------------------------------------------------------------
  // STATE — lazy initializers so remounting via key resets correctly
  // ---------------------------------------------------------------------------

  // Derive main status and modifier from the stored record status
  const getMainStatus = (s) => (s === "Late" || s === "Half Day" ? "Present" : (s || "Present"));
  const getModifier = (s) => (s === "Late" || s === "Half Day" ? s : "None");

  const [mainStatus, setMainStatus] = useState(() => getMainStatus(record?.status));
  const [modifier, setModifier] = useState(() => getModifier(record?.status));
  const [shiftId, setShiftId] = useState(() => {
    const fromRecord = record?.shift?._id || (typeof record?.shift === "string" ? record.shift : "");
    return fromRecord || preloadedShift?._id || "";
  });
  const [checkInTime, setCheckInTime] = useState(() => {
    return toTimeStr(record?.checkIn) || (!record && preloadedShift ? preloadedShift.startTime : "");
  });
  const [checkOutTime, setCheckOutTime] = useState(() => {
    return toTimeStr(record?.checkOut) || (!record && preloadedShift ? preloadedShift.endTime : "");
  });
  const [lateDurationMinutes, setLateDurationMinutes] = useState(
    () => record?.lateDurationMinutes || 0,
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // The actual stored status value derived from mainStatus + modifier
  const effectiveStatus = mainStatus === "Present" && modifier !== "None" ? modifier : mainStatus;

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
  const { data: shiftsList = [], isLoading: isLoadingShifts } = useQuery({
    queryKey: ["shiftsList"],
    queryFn: fetchShiftsList,
    enabled: open,
  });

  // ---------------------------------------------------------------------------
  // SHIFT CHANGE HANDLER — auto-fills check-in/out times when shift is selected
  // ---------------------------------------------------------------------------
  const handleShiftChange = useCallback(
    (newShiftId) => {
      setShiftId(newShiftId);
      const selectedShift = shiftsList.find((s) => s._id === newShiftId);
      if (selectedShift) {
        if (!checkInTime) setCheckInTime(selectedShift.startTime);
        if (!checkOutTime) setCheckOutTime(selectedShift.endTime);
      }
    },
    [shiftsList, checkInTime, checkOutTime],
  );

  // ---------------------------------------------------------------------------
  // MUTATIONS
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAttendance(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      toast.success("Attendance updated");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update attendance",
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: markSingleAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      toast.success("Attendance record created");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to create attendance",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      toast.success("Attendance record deleted");
      setDeleteDialogOpen(false);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to delete attendance",
      );
    },
  });

  const isPending =
    updateMutation.isPending ||
    createMutation.isPending ||
    deleteMutation.isPending;

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------
  const handleSave = () => {
    if (!mainStatus) {
      toast.error("Please select a status");
      return;
    }

    if (!shiftId) {
      toast.error("Please select a shift");
      return;
    }

    const checkInISO = combineDateAndTime(dateStr, checkInTime);
    const checkOutISO = combineDateAndTime(dateStr, checkOutTime);

    if (isNewRecord) {
      createMutation.mutate({
        employeeId,
        date: dateStr,
        status: effectiveStatus,
        shiftId: shiftId || undefined,
        checkIn: checkInISO || undefined,
        checkOut: checkOutISO || undefined,
        lateDurationMinutes: effectiveStatus === "Late" ? Number(lateDurationMinutes) || 0 : 0,
      });
    } else {
      updateMutation.mutate({
        id: record._id,
        payload: {
          status: effectiveStatus,
          shiftId: shiftId || null,
          checkIn: checkInISO || null,
          checkOut: checkOutISO || null,
          lateDurationMinutes: effectiveStatus === "Late" ? Number(lateDurationMinutes) || 0 : 0,
        },
      });
    }
  };

  const handleDelete = () => {
    if (!record?._id) return;
    deleteMutation.mutate(record._id);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  const selectedShiftObj = shiftsList.find((s) => s._id === shiftId);

  const DAY_ABBR = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };
  const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayName = date ? date.toLocaleString("en-GB", { weekday: "long", timeZone: "UTC" }) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isNewRecord ? "Mark Attendance" : "Edit Attendance"}
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{employeeName}</span>
              {" — "}
              {date ? `${dayName}, ${formatDate(date)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Status */}
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={mainStatus} onValueChange={(val) => { setMainStatus(val); if (val !== "Present") setModifier("None"); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="Present">Present</SelectItem>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Off">Off</SelectItem>
                    <SelectItem value="Leave">Leave</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Modifier (only when Present) */}
            {mainStatus === "Present" && (
              <div className="grid gap-2">
                <Label>Attendance Modifier</Label>
                <Select value={modifier} onValueChange={setModifier}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="None">None — Full Day Present</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                      <SelectItem value="Half Day">Half Day</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Shift */}
            <div className="grid gap-2">
              <Label>
                Shift
              </Label>
              {isLoadingShifts ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" /> Loading shifts...
                </div>
              ) : (
                <Select value={shiftId || "_none_"} onValueChange={(val) => handleShiftChange(val === "_none_" ? "" : val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a shift..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="_none_">
                        <span className="text-muted-foreground">
                          — No shift selected —
                        </span>
                      </SelectItem>
                      {shiftsList.map((shift) => (
                        <SelectItem key={shift._id} value={shift._id}>
                          {shift.name} ({formatTimeToAMPM(shift.startTime)} —{" "}
                          {formatTimeToAMPM(shift.endTime)})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              {selectedShiftObj && (
                <div className="grid gap-0.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Working:</span>{" "}
                    {selectedShiftObj.workingDays?.map((d) => DAY_ABBR[d] || d).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Off:</span>{" "}
                    {ALL_DAYS.filter((d) => !selectedShiftObj.workingDays?.includes(d)).map((d) => DAY_ABBR[d]).join(" · ") || "—"}
                  </p>
                </div>
              )}
            </div>

            {/* Check In */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="checkIn">Check In</Label>
                <input
                  id="checkIn"
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkOut">Check Out</Label>
                <input
                  id="checkOut"
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Late Duration (shown when modifier is Late) */}
            {effectiveStatus === "Late" && (
              <div className="grid gap-2">
                <Label htmlFor="lateDuration">Late by (minutes)</Label>
                <input
                  id="lateDuration"
                  type="number"
                  min="0"
                  value={lateDurationMinutes}
                  onChange={(e) =>
                    setLateDurationMinutes(Number(e.target.value))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 justify-between">
            {/* Delete (only for existing records) */}
            {!isNewRecord && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isPending}
                className="mr-auto"
              >
                Delete
              </Button>
            )}

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="green"
                onClick={handleSave}
                disabled={isPending}
              >
                {updateMutation.isPending || createMutation.isPending ? (
                  <>
                    <Spinner />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the attendance record for{" "}
              <strong>{employeeName}</strong> on{" "}
              <strong>{date ? formatDate(date) : ""}</strong>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AttendanceCellEditModal;
