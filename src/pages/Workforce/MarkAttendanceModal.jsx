// React
import { useCallback, useEffect, useMemo, useState } from "react";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import { toast } from "sonner";

// Components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
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
import { fetchShiftsList } from "@/services/employeeShiftsApi";

// Utils
import { formatDate, formatTimeToAMPM } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

// =============================================================================
// HELPERS
// =============================================================================

const generateDatesFromRanges = (dateRanges) => {
  const allDates = [];
  for (const range of dateRanges) {
    if (!range.startDate || !range.endDate) continue;
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const current = new Date(start);
    while (current <= end) {
      allDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }
  return allDates;
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * MarkAttendanceModal
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange: (open: boolean) => void
 *  - preSelectedEmployeeIds: string[] | null
 *    When provided (from AllEmployees page), employee selection is hidden.
 *    When null/undefined (from AttendanceRecords page), employee multi-select is shown.
 *  - onSuccess: () => void  — callback after successful submission
 */
const MarkAttendanceModal = ({
  open,
  onOpenChange,
  preSelectedEmployeeIds,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // When preSelectedEmployeeIds is provided use it; otherwise manage internally
  const hasPreSelected =
    Array.isArray(preSelectedEmployeeIds) && preSelectedEmployeeIds.length > 0;

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [debouncedEmployeeQuery, setDebouncedEmployeeQuery] = useState("");

  const [dateRanges, setDateRanges] = useState([
    { startDate: undefined, endDate: undefined },
  ]);
  const [datePickerOpenIndex, setDatePickerOpenIndex] = useState(null);
  const [datePickerType, setDatePickerType] = useState(null); // 'start' | 'end'

  const [fallbackShiftId, setFallbackShiftId] = useState("");
  const [forceApplyShift, setForceApplyShift] = useState(false);
  const [markAllDaysPresent, setMarkAllDaysPresent] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  const [errors, setErrors] = useState({});
  const [submissionErrors, setSubmissionErrors] = useState([]);

  // ---------------------------------------------------------------------------
  // RESET
  // ---------------------------------------------------------------------------
  const resetForm = useCallback(() => {
    setSelectedEmployeeIds([]);
    setEmployeeSearchQuery("");
    setDebouncedEmployeeQuery("");
    setDateRanges([{ startDate: undefined, endDate: undefined }]);
    setDatePickerOpenIndex(null);
    setDatePickerType(null);
    setFallbackShiftId("");
    setForceApplyShift(false);
    setMarkAllDaysPresent(false);
    setOverwrite(false);
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

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // MUTATION
  // ---------------------------------------------------------------------------
  const markMutation = useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attendance-monthly"] });
      if (data.errors && data.errors.length > 0) {
        // Show partial success and keep modal open to display errors
        const msg =
          data.created > 0 || data.skipped > 0
            ? `${data.created} record(s) created, ${data.skipped} skipped.`
            : null;
        if (msg) toast.success(msg);
        setSubmissionErrors(data.errors);
        onSuccess?.();
      } else {
        const msg =
          data.message ||
          `Attendance marked: ${data.created} created, ${data.skipped} skipped`;
        toast.success(msg);
        handleOpenChange(false);
        onSuccess?.();
      }
    },
    onError: (error) => {
      const msg =
        error.response?.data?.message || "Failed to mark attendance";
      toast.error(msg);
    },
  });

  // ---------------------------------------------------------------------------
  // COMPUTED
  // ---------------------------------------------------------------------------
  const activeEmployeeIds = hasPreSelected
    ? preSelectedEmployeeIds
    : selectedEmployeeIds;

  const totalDays = useMemo(
    () => generateDatesFromRanges(dateRanges).length,
    [dateRanges],
  );

  // ---------------------------------------------------------------------------
  // DATE RANGE HANDLERS
  // ---------------------------------------------------------------------------
  const addDateRange = () => {
    setDateRanges((prev) => [
      ...prev,
      { startDate: undefined, endDate: undefined },
    ]);
  };

  const removeDateRange = (index) => {
    setDateRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDateRange = (index, field, value) => {
    setDateRanges((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
    // Clear end if start changes and end is now before start
    if (field === "startDate") {
      setDateRanges((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          if (r.endDate && value && r.endDate < value) {
            return { ...r, startDate: value, endDate: undefined };
          }
          return { ...r, startDate: value };
        }),
      );
    }
  };

  // ---------------------------------------------------------------------------
  // EMPLOYEE SELECTION HANDLERS
  // ---------------------------------------------------------------------------
  const toggleEmployee = (empId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(empId)
        ? prev.filter((id) => id !== empId)
        : [...prev, empId],
    );
  };

  // ---------------------------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------------------------
  const handleSubmit = () => {
    const newErrors = {};

    if (activeEmployeeIds.length === 0) {
      newErrors.employees = "Please select at least one employee";
    }

    const hasValidRange = dateRanges.some((r) => r.startDate && r.endDate);
    if (!hasValidRange) {
      newErrors.dateRanges = "At least one complete date range is required";
    }

    for (let i = 0; i < dateRanges.length; i++) {
      const r = dateRanges[i];
      if (r.startDate && r.endDate && r.endDate < r.startDate) {
        newErrors.dateRanges = "End date cannot be before start date";
        break;
      }
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

    const validRanges = dateRanges
      .filter((r) => r.startDate && r.endDate)
      .map((r) => {
        // Use local date parts to avoid UTC shift stripping the last day
        const toLocalDateStr = (d) => {
          const y = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${mo}-${day}`;
        };
        return {
          startDate: toLocalDateStr(r.startDate),
          endDate: toLocalDateStr(r.endDate),
        };
      });

    markMutation.mutate({
      employeeIds: activeEmployeeIds,
      dateRanges: validRanges,
      fallbackShiftId: fallbackShiftId || undefined,
      forceApplyShift,
      overwrite,
      markAllDaysPresent,
    });
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            {hasPreSelected
              ? `Mark attendance for ${preSelectedEmployeeIds.length} selected employee(s).`
              : "Select employees and date ranges to mark attendance."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* ---------------------------------------------------------------- */}
          {/* Employee Multi-select (only shown when no preSelectedEmployeeIds) */}
          {/* ---------------------------------------------------------------- */}
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
                          {employeesList.map((emp) => (
                            <CommandItem
                              key={emp._id}
                              value={`${emp.fullName} ${emp.employeeID}`}
                              onSelect={() => toggleEmployee(emp._id)}
                              className="cursor-pointer"
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedEmployeeIds.includes(emp._id)
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {emp.fullName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {emp.employeeID}
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

          {/* ---------------------------------------------------------------- */}
          {/* Date Ranges                                                       */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">
                Date Range(s)
                {totalDays > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({totalDays} {totalDays === 1 ? "day" : "days"})
                  </span>
                )}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addDateRange}
                className="h-7 text-xs text-primary hover:text-primary hover:bg-green-50"
              >
                <PlusIcon size={12} className="mr-1" />
                Add Range
              </Button>
            </div>

            {dateRanges.map((range, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-1 gap-2">
                  {/* Start Date */}
                  <Popover
                    open={
                      datePickerOpenIndex === index &&
                      datePickerType === "start"
                    }
                    onOpenChange={(isOpen) => {
                      if (isOpen) {
                        setDatePickerOpenIndex(index);
                        setDatePickerType("start");
                      } else {
                        setDatePickerOpenIndex(null);
                        setDatePickerType(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal cursor-pointer",
                          !range.startDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {range.startDate
                            ? formatDate(range.startDate)
                            : "Start date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={range.startDate}
                        onSelect={(date) => {
                          updateDateRange(index, "startDate", date);
                          setDatePickerOpenIndex(null);
                          setDatePickerType(null);
                        }}
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(2030, 11)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {/* End Date */}
                  <Popover
                    open={
                      datePickerOpenIndex === index && datePickerType === "end"
                    }
                    onOpenChange={(isOpen) => {
                      if (isOpen) {
                        setDatePickerOpenIndex(index);
                        setDatePickerType("end");
                      } else {
                        setDatePickerOpenIndex(null);
                        setDatePickerType(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal cursor-pointer",
                          !range.endDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {range.endDate
                            ? formatDate(range.endDate)
                            : "End date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={range.endDate}
                        onSelect={(date) => {
                          updateDateRange(index, "endDate", date);
                          setDatePickerOpenIndex(null);
                          setDatePickerType(null);
                        }}
                        disabled={(date) =>
                          range.startDate ? date < range.startDate : false
                        }
                        startMonth={new Date(2020, 0)}
                        endMonth={new Date(2030, 11)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Remove range button (only if more than 1 range) */}
                {dateRanges.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDateRange(index)}
                    className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                  >
                    <TrashIcon size={15} />
                  </Button>
                )}
              </div>
            ))}

            {errors.dateRanges && (
              <p className="text-sm text-red-500">{errors.dateRanges}</p>
            )}
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Fallback Shift                                                    */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-2">
            <Label className="text-foreground">
              Shift{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (employees without an assigned shift will use this)
              </span>
            </Label>
            <Select
              value={fallbackShiftId}
              onValueChange={setFallbackShiftId}
            >
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
                        {shift.name} ({formatTimeToAMPM(shift.startTime)} —{" "}
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

          <Separator />

          {/* ---------------------------------------------------------------- */}
          {/* Options                                                           */}
          {/* ---------------------------------------------------------------- */}
          <div className="grid gap-3">
            <Label className="text-foreground">Options</Label>

            {/* Force Apply Shift */}
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
                  Apply the selected shift above to ALL employees, ignoring
                  their individually assigned shifts.
                </p>
              </div>
            </div>

            {/* Mark Present on All Days */}
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
                  Mark Present on All Days
                </label>
                <p className="text-xs text-muted-foreground">
                  Mark Present even on shift off days (e.g., Fridays). By
                  default, off days are marked as Off.
                </p>
              </div>
            </div>

            {/* Overwrite Existing */}
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
                  Replace existing attendance records for the selected dates. By
                  default, existing records are preserved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Submission Errors                                                   */}
        {/* ------------------------------------------------------------------ */}
        {submissionErrors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 grid gap-2">
            <p className="text-sm font-medium text-red-700">
                {submissionErrors.length} entries could not be processed:
            </p>
            <ul className="space-y-1">
              {submissionErrors.map((err, i) => {
                const emp = employeesList.find((e) => e._id === err.employeeId);
                const label = emp
                  ? `${emp.fullName} (${emp.employeeID})`
                  : err.employeeId;
                return (
                  <li key={i} className="text-xs text-red-600">
                    <span className="font-semibold">{label}</span>
                    {err.date && (
                      <span className="text-red-400"> [{err.date}]</span>
                    )}
                    {": "}
                    {err.error}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Footer                                                              */}
        {/* ------------------------------------------------------------------ */}
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
