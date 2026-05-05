// React
import { useCallback, useEffect, useState } from "react";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import { toast } from "sonner";

// Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

// Services
import { bulkMarkAttendance } from "@/services/attendancesApi";
import { fetchEmployeesList } from "@/services/employeesApi";
import {
  fetchEmployeeShiftOnDate,
  fetchShiftsList,
} from "@/services/employeeShiftsApi";

// Utils
import { formatDate, formatTimeToAMPM } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

/**
 * MarkAttendanceModal
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - preSelectedEmployeeIds: string[] | null
 *    When provided, employee selection is hidden and those employees are used.
 *  - onSuccess: () => void
 */
const MarkAttendanceModal = ({
  open,
  onOpenChange,
  preSelectedEmployeeIds,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const hasPreSelected =
    Array.isArray(preSelectedEmployeeIds) && preSelectedEmployeeIds.length > 0;

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [debouncedEmployeeQuery, setDebouncedEmployeeQuery] = useState("");

  const [attendanceDate, setAttendanceDate] = useState(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [fallbackShiftId, setFallbackShiftId] = useState("");
  const [forceApplyShift, setForceApplyShift] = useState(false);
  const [markAllDaysPresent, setMarkAllDaysPresent] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  // Per-employee status / time overrides (used primarily when 1 employee is targeted)
  const [manualStatus, setManualStatus] = useState(""); // "" => auto
  const [manualCheckIn, setManualCheckIn] = useState(""); // HH:MM
  const [manualCheckOut, setManualCheckOut] = useState(""); // HH:MM
  const [manualSeg1In, setManualSeg1In] = useState("");
  const [manualSeg1Out, setManualSeg1Out] = useState("");
  const [manualSeg2In, setManualSeg2In] = useState("");
  const [manualSeg2Out, setManualSeg2Out] = useState("");

  const [errors, setErrors] = useState({});
  const [submissionErrors, setSubmissionErrors] = useState([]);

  const resetForm = useCallback(() => {
    setSelectedEmployeeIds([]);
    setEmployeeSearchQuery("");
    setDebouncedEmployeeQuery("");
    setAttendanceDate(undefined);
    setDatePickerOpen(false);
    setFallbackShiftId("");
    setForceApplyShift(false);
    setMarkAllDaysPresent(false);
    setOverwrite(false);
    setManualStatus("");
    setManualCheckIn("");
    setManualCheckOut("");
    setManualSeg1In("");
    setManualSeg1Out("");
    setManualSeg2In("");
    setManualSeg2Out("");
    setErrors({});
    setSubmissionErrors([]);
  }, []);

  const handleOpenChange = (isOpen) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setTimeout(resetForm, 200);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEmployeeQuery(employeeSearchQuery.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [employeeSearchQuery]);

  const { data: employeesList = [], isFetching: isLoadingEmployees } = useQuery({
    queryKey: ["employees-list", debouncedEmployeeQuery],
    queryFn: () =>
      fetchEmployeesList({ q: debouncedEmployeeQuery, limit: 10 }),
    enabled:
      open &&
      !hasPreSelected &&
      employeeComboboxOpen &&
      debouncedEmployeeQuery.length >= 1,
    select: (data) => data?.employees || [],
    placeholderData: (previous) => previous,
  });

  const {
    data: shiftsList = [],
    isLoading: isLoadingShifts,
  } = useQuery({
    queryKey: ["shiftsList"],
    queryFn: fetchShiftsList,
    enabled: open,
  });

  const markMutation = useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      if (data.errors && data.errors.length > 0) {
        const msg =
          data.created > 0 || data.skipped > 0
            ? `${data.created} record(s) created, ${data.skipped} skipped.`
            : null;
        if (msg) {
          toast.success(msg);
        }
        setSubmissionErrors(data.errors);
        onSuccess?.();
        return;
      }

      const msg =
        data.message ||
        `Attendance marked: ${data.created} created, ${data.skipped} skipped`;
      toast.success(msg);
      handleOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message || "Failed to mark attendance";
      toast.error(msg);
    },
  });

  const activeEmployeeIds = hasPreSelected
    ? preSelectedEmployeeIds
    : selectedEmployeeIds;

  // Auto-resolve the assigned shift when exactly 1 employee + a date are chosen
  const isSingleEmployee = activeEmployeeIds.length === 1;
  const singleEmployeeId = isSingleEmployee ? activeEmployeeIds[0] : null;
  const dateForShift = attendanceDate
    ? `${attendanceDate.getFullYear()}-${String(attendanceDate.getMonth() + 1).padStart(2, "0")}-${String(attendanceDate.getDate()).padStart(2, "0")}`
    : null;

  const { data: resolvedEmployeeShift = null, isFetching: isFetchingEmployeeShift } =
    useQuery({
      queryKey: ["employee-shift-on-date", singleEmployeeId, dateForShift],
      queryFn: () =>
        fetchEmployeeShiftOnDate({
          employeeId: singleEmployeeId,
          date: dateForShift,
        }),
      enabled: open && !!singleEmployeeId && !!dateForShift,
    });

  // Effective shift used for status / off-day decisions in the UI:
  // forced shift > resolved employee shift > selected fallback shift
  const fallbackShiftObject =
    fallbackShiftId
      ? shiftsList.find((s) => s._id === fallbackShiftId) || null
      : null;
  const effectiveShift =
    forceApplyShift && fallbackShiftObject
      ? fallbackShiftObject
      : resolvedEmployeeShift || fallbackShiftObject;

  const dayName = attendanceDate
    ? attendanceDate.toLocaleDateString("en-US", { weekday: "long" })
    : null;
  const isOffDayForShift =
    effectiveShift && dayName
      ? !(effectiveShift.workingDays || []).includes(dayName)
      : false;
  const isSplitShiftSelected =
    !!effectiveShift &&
    Array.isArray(effectiveShift.segments) &&
    effectiveShift.segments.length === 2;

  // When off-day is detected, force status to Present (only allowed value)
  useEffect(() => {
    if (isOffDayForShift && manualStatus && manualStatus !== "Present") {
      setManualStatus("Present");
    }
  }, [isOffDayForShift, manualStatus]);

  // When effective shift changes, prefill check-in/out from shift defaults
  useEffect(() => {
    if (!effectiveShift) return;
    if (isSplitShiftSelected) {
      const [s1, s2] = effectiveShift.segments;
      setManualSeg1In((v) => v || (s1?.startTime || "").slice(0, 5));
      setManualSeg1Out((v) => v || (s1?.endTime || "").slice(0, 5));
      setManualSeg2In((v) => v || (s2?.startTime || "").slice(0, 5));
      setManualSeg2Out((v) => v || (s2?.endTime || "").slice(0, 5));
    } else {
      setManualCheckIn((v) => v || (effectiveShift.startTime || "").slice(0, 5));
      setManualCheckOut((v) => v || (effectiveShift.endTime || "").slice(0, 5));
    }
  }, [effectiveShift, isSplitShiftSelected]);

  const toggleEmployee = (employeeId) => {
    setSelectedEmployeeIds((previous) =>
      previous.includes(employeeId)
        ? previous.filter((id) => id !== employeeId)
        : [...previous, employeeId],
    );
  };

  const handleSubmit = () => {
    const newErrors = {};

    if (activeEmployeeIds.length === 0) {
      newErrors.employees = "Please select at least one employee";
    }

    if (!attendanceDate) {
      newErrors.attendanceDate = "Please select an attendance date";
    }

    if (!fallbackShiftId) {
      newErrors.fallbackShift =
        "Select a shift. Employees without an assigned shift will use this as their shift.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const year = attendanceDate.getFullYear();
    const month = String(attendanceDate.getMonth() + 1).padStart(2, "0");
    const day = String(attendanceDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // Build manual time payloads (only when status is Present/Late/Half Day)
    const wantsTimes =
      manualStatus &&
      manualStatus !== "Off" &&
      manualStatus !== "Absent" &&
      manualStatus !== "Leave";

    const toIso = (hhmm) => {
      if (!hhmm) return undefined;
      const [h, m] = hhmm.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return undefined;
      const d = new Date(attendanceDate);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    let manualCheckInIso;
    let manualCheckOutIso;
    let manualSegmentsPayload;
    if (wantsTimes && isSplitShiftSelected) {
      manualSegmentsPayload = [
        { checkIn: toIso(manualSeg1In), checkOut: toIso(manualSeg1Out) },
        { checkIn: toIso(manualSeg2In), checkOut: toIso(manualSeg2Out) },
      ];
    } else if (wantsTimes) {
      manualCheckInIso = toIso(manualCheckIn);
      manualCheckOutIso = toIso(manualCheckOut);
    }

    markMutation.mutate({
      employeeIds: activeEmployeeIds,
      date: dateStr,
      fallbackShiftId: fallbackShiftId || undefined,
      forceApplyShift,
      overwrite,
      markAllDaysPresent,
      manualStatus: manualStatus || undefined,
      manualCheckIn: manualCheckInIso,
      manualCheckOut: manualCheckOutIso,
      manualSegments: manualSegmentsPayload,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            {hasPreSelected
              ? `Mark attendance for ${preSelectedEmployeeIds.length} selected employee(s) on one date.`
              : "Select employees and a single attendance date."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {!hasPreSelected && (
            <div className="grid gap-2">
              <Label className="text-foreground">
                Employees{" "}
                {selectedEmployeeIds.length > 0 && (
                  <Badge className="ml-1 bg-primary text-white text-[10px] h-4 px-1.5">
                    {selectedEmployeeIds.length}
                  </Badge>
                )}
              </Label>
              <Popover
                open={employeeComboboxOpen}
                onOpenChange={setEmployeeComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={employeeComboboxOpen}
                    className="w-full justify-between font-normal cursor-pointer min-h-9 h-auto py-1.5"
                  >
                    <span className="text-left truncate">
                      {selectedEmployeeIds.length === 0
                        ? "Search and select employees..."
                        : selectedEmployeeIds.length === 1
                          ? "1 employee selected"
                          : `${selectedEmployeeIds.length} employees selected`}
                    </span>
                    <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by name or ID..."
                      value={employeeSearchQuery}
                      onValueChange={setEmployeeSearchQuery}
                    />
                    <CommandList className="max-h-64">
                      {employeeSearchQuery.trim().length < 1 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          Type to search employees.
                        </div>
                      ) : isLoadingEmployees ? (
                        <div className="flex items-center justify-center p-4">
                          <Spinner />
                        </div>
                      ) : employeesList.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          No employee found.
                        </div>
                      ) : (
                        <CommandGroup>
                          {employeesList.map((employee) => (
                            <CommandItem
                              key={employee._id}
                              value={`${employee.fullName} ${employee.employeeID}`}
                              onSelect={() => toggleEmployee(employee._id)}
                              className="cursor-pointer"
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEmployeeIds.includes(employee._id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {employee.fullName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {employee.employeeID}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {errors.employees && (
                <p className="text-sm text-red-500">{errors.employees}</p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label className="text-foreground">Attendance Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal cursor-pointer",
                    !attendanceDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {attendanceDate
                      ? formatDate(attendanceDate)
                      : "Select attendance date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={attendanceDate}
                  onSelect={(date) => {
                    setAttendanceDate(date);
                    setDatePickerOpen(false);
                  }}
                  startMonth={new Date(2020, 0)}
                  endMonth={new Date(2030, 11)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.attendanceDate && (
              <p className="text-sm text-red-500">{errors.attendanceDate}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-foreground">
              Shift{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (employees without an assigned shift will use this)
              </span>
            </Label>
            <Select value={fallbackShiftId} onValueChange={setFallbackShiftId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a shift..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {isLoadingShifts ? (
                    <div className="flex items-center justify-center p-2">
                      <Spinner />
                    </div>
                  ) : shiftsList.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No approved shifts available
                    </SelectItem>
                  ) : (
                    shiftsList.map((shift) => (
                      <SelectItem key={shift._id} value={shift._id}>
                        {shift.name} ({formatTimeToAMPM(shift.startTime)} -{" "}
                        {formatTimeToAMPM(shift.endTime)})
                      </SelectItem>
                    ))
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
            {errors.fallbackShift && (
              <p className="text-sm text-red-500">{errors.fallbackShift}</p>
            )}
          </div>

          {/* Resolved-shift hint shown when single employee + date selected */}
          {isSingleEmployee && attendanceDate && (
            <div className="rounded-md border border-input bg-muted/30 p-3 grid gap-1">
              <Label className="text-foreground text-xs uppercase tracking-wide">
                Assigned Shift
              </Label>
              {isFetchingEmployeeShift ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : effectiveShift ? (
                <div className="text-sm">
                  <span className="font-medium">{effectiveShift.name}</span>
                  {isSplitShiftSelected ? (
                    <span className="ml-2 text-muted-foreground">
                      Split:{" "}
                      {formatTimeToAMPM(effectiveShift.segments[0].startTime)}–
                      {formatTimeToAMPM(effectiveShift.segments[0].endTime)} |{" "}
                      {formatTimeToAMPM(effectiveShift.segments[1].startTime)}–
                      {formatTimeToAMPM(effectiveShift.segments[1].endTime)}
                    </span>
                  ) : (
                    <span className="ml-2 text-muted-foreground">
                      {formatTimeToAMPM(effectiveShift.startTime)}–
                      {formatTimeToAMPM(effectiveShift.endTime)}
                    </span>
                  )}
                  {isOffDayForShift && (
                    <Badge className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100">
                      Off Day — only Present allowed
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No shift assigned. Select a fallback shift above.
                </p>
              )}
            </div>
          )}

          {/* Status selector + manual times (single-employee scenario) */}
          {isSingleEmployee && attendanceDate && effectiveShift && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label className="text-foreground">Status</Label>
                <Select
                  value={manualStatus || "auto"}
                  onValueChange={(v) => setManualStatus(v === "auto" ? "" : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Auto (based on shift)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (based on shift)</SelectItem>
                    <SelectItem value="Present">Present</SelectItem>
                    {!isOffDayForShift && (
                      <SelectItem value="Absent">Absent</SelectItem>
                    )}
                    {!isOffDayForShift && (
                      <SelectItem value="Off">Off</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Show check-in/out only when status implies attendance */}
              {manualStatus &&
                manualStatus !== "Off" &&
                manualStatus !== "Absent" &&
                manualStatus !== "Leave" && (
                  isSplitShiftSelected ? (
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label className="text-foreground text-xs uppercase tracking-wide">
                          Segment 1
                        </Label>
                        <div className="flex gap-3">
                          <Input
                            type="time"
                            value={manualSeg1In}
                            onChange={(e) => setManualSeg1In(e.target.value)}
                            className="bg-background flex-1"
                          />
                          <Input
                            type="time"
                            value={manualSeg1Out}
                            onChange={(e) => setManualSeg1Out(e.target.value)}
                            className="bg-background flex-1"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-foreground text-xs uppercase tracking-wide">
                          Segment 2
                        </Label>
                        <div className="flex gap-3">
                          <Input
                            type="time"
                            value={manualSeg2In}
                            onChange={(e) => setManualSeg2In(e.target.value)}
                            className="bg-background flex-1"
                          />
                          <Input
                            type="time"
                            value={manualSeg2Out}
                            onChange={(e) => setManualSeg2Out(e.target.value)}
                            className="bg-background flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="grid gap-2 flex-1">
                        <Label className="text-foreground">Check In</Label>
                        <Input
                          type="time"
                          value={manualCheckIn}
                          onChange={(e) => setManualCheckIn(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                      <div className="grid gap-2 flex-1">
                        <Label className="text-foreground">Check Out</Label>
                        <Input
                          type="time"
                          value={manualCheckOut}
                          onChange={(e) => setManualCheckOut(e.target.value)}
                          className="bg-background"
                        />
                      </div>
                    </div>
                  )
                )}
            </div>
          )}

          <Separator />

          <div className="grid gap-3">
            <Label className="text-foreground">Options</Label>

            <div className="flex items-start gap-3">
              <Checkbox
                id="forceApplyShift"
                checked={forceApplyShift}
                onCheckedChange={(checked) => setForceApplyShift(!!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="forceApplyShift"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Force Apply Shift
                </label>
                <p className="text-xs text-muted-foreground">
                  Apply the selected shift above to all selected employees,
                  ignoring their individually assigned shifts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="markAllDaysPresent"
                checked={markAllDaysPresent}
                onCheckedChange={(checked) => setMarkAllDaysPresent(!!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="markAllDaysPresent"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Mark Present on the Selected Date
                </label>
                <p className="text-xs text-muted-foreground">
                  Mark Present even if the selected date is an off day for the
                  applied shift.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="overwrite"
                checked={overwrite}
                onCheckedChange={(checked) => setOverwrite(!!checked)}
                className="mt-0.5"
              />
              <div className="grid gap-0.5">
                <label
                  htmlFor="overwrite"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Overwrite Existing Records
                </label>
                <p className="text-xs text-muted-foreground">
                  Replace existing attendance records for the selected date. By
                  default, existing records are preserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {submissionErrors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 grid gap-2">
            <p className="text-sm font-medium text-red-700">
              {submissionErrors.length} entries could not be processed:
            </p>
            <ul className="space-y-1">
              {submissionErrors.map((errorItem, index) => {
                const employee = employeesList.find(
                  (item) => item._id === errorItem.employeeId,
                );
                const label = employee
                  ? `${employee.fullName} (${employee.employeeID})`
                  : errorItem.employeeId;

                return (
                  <li key={index} className="text-xs text-red-600">
                    <span className="font-semibold">{label}</span>
                    {errorItem.date && (
                      <span className="text-red-400"> [{errorItem.date}]</span>
                    )}
                    {": "}
                    {errorItem.error}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={markMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="green"
            onClick={handleSubmit}
            disabled={markMutation.isPending}
          >
            {markMutation.isPending ? (
              <>
                <Spinner />
                Marking...
              </>
            ) : (
              "Mark Attendance"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkAttendanceModal;
