// React
import React, { useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import { toast } from "sonner";

// Components
import DataTable from "@/components/DataTable/data-table";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Services
import {
  createWorkProgressReport,
  deleteWorkProgressReport,
  fetchWorkProgressReports,
  updateWorkProgressReport,
} from "@/services/workProgressReportsApi";
import { fetchEmployeesList } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";

// Styles
import styles from "./WorkProgressReports.module.css";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Truncate text to first 2 words + ellipsis for table display.
 */
const truncateText = (text) => {
  if (!text) return "-";
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) return text;
  return words.slice(0, 2).join(" ") + "...";
};

/**
 * Calculate number of days between two dates.
 */
const calcDaysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return "";
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end - start;
  if (diffMs <= 0) return "";
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculate deadline date from assignment date + days.
 */
const calcDeadlineFromDays = (assignmentDate, days) => {
  if (!assignmentDate || !days || days < 1) return null;
  const date = new Date(assignmentDate);
  date.setDate(date.getDate() + Number(days));
  return date;
};

// ============================================================================
// COMPONENT
// ============================================================================

const WorkProgressReports = () => {
  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  const getInitialLimit = () => {
    const urlLimit = searchParams.get("limit");
    return urlLimit ? Number(urlLimit) : 10;
  };

  const getInitialPage = () => {
    const urlPage = searchParams.get("page");
    return urlPage ? Number(urlPage) : 1;
  };

  const getInitialSearch = () => {
    return searchParams.get("search") || "";
  };

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingReport, setEditingReport] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReport, setDeletingReport] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(undefined);
  const [deadlineDate, setDeadlineDate] = useState(undefined);
  const [daysForCompletion, setDaysForCompletion] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [completionDate, setCompletionDate] = useState(undefined);
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [assignDatePickerOpen, setAssignDatePickerOpen] = useState(false);
  const [deadlineDatePickerOpen, setDeadlineDatePickerOpen] = useState(false);
  const [completionDatePickerOpen, setCompletionDatePickerOpen] = useState(false);

  // Track which field triggered auto-calc to avoid infinite loops
  const [lastChangedField, setLastChangedField] = useState(null);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Reset page on search
  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  // Sync URL params
  useEffect(() => {
    const params = {};
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // Auto-calculate days when dates change
  useEffect(() => {
    if (lastChangedField === "deadline" || lastChangedField === "assignmentDate") {
      if (assignmentDate && deadlineDate) {
        const days = calcDaysBetween(assignmentDate, deadlineDate);
        if (days && days > 0) {
          setDaysForCompletion(String(days));
        }
      }
    }
  }, [assignmentDate, deadlineDate, lastChangedField]);

  // Auto-calculate deadline when days change
  useEffect(() => {
    if (lastChangedField === "days" && assignmentDate && daysForCompletion) {
      const days = parseInt(daysForCompletion, 10);
      if (days > 0) {
        const newDeadline = calcDeadlineFromDays(assignmentDate, days);
        if (newDeadline) {
          setDeadlineDate(newDeadline);
        }
      }
    }
  }, [daysForCompletion, assignmentDate, lastChangedField]);

  // Clear completion date when status is not Completed
  useEffect(() => {
    if (status && status !== "Completed") {
      setCompletionDate(undefined);
      setRemarks("");
    }
  }, [status]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // Fetch work progress reports
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "work-progress-reports",
      { limit, page, search: debouncedSearch },
    ],
    queryFn: () =>
      fetchWorkProgressReports({ limit, page, search: debouncedSearch }),
  });

  // Fetch Employees List (for combobox)
  const { data: employeesData } = useQuery({
    queryKey: ["employees-list"],
    queryFn: fetchEmployeesList,
    enabled: dialogOpen,
  });

  const employeesList = useMemo(
    () => employeesData?.employees || [],
    [employeesData],
  );

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: createWorkProgressReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Task assigned successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to assign task";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateWorkProgressReport(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Task updated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update task";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteWorkProgressReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-progress-reports"] });
      setDeleteDialogOpen(false);
      setDeletingReport(null);
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to delete task";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "employeeName",
      label: "Assigned To",
      fontWeight: "medium",
      render: (row) => row.employee?.fullName || "-",
    },
    {
      key: "employeeID",
      label: "Employee ID",
      render: (row) => row.employee?.employeeID || "-",
    },
    {
      key: "assignedBy",
      label: "Assigned By",
      render: (row) => row.assignedBy || "-",
    },
    {
      key: "assignmentDate",
      label: "Assignment Date",
      render: (row) =>
        row.assignmentDate ? formatDate(row.assignmentDate) : "-",
    },
    {
      key: "deadline",
      label: "Deadline",
      render: (row) => (row.deadline ? formatDate(row.deadline) : "-"),
    },
    {
      key: "completionDate",
      label: "Completion Date",
      render: (row) =>
        row.completionDate ? formatDate(row.completionDate) : "-",
    },
    {
      key: "description",
      label: "Description",
      render: (row) => {
        const full = row.description || "";
        const truncated = truncateText(full);
        if (truncated === full) return full || "-";
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.descriptionCell}>{truncated}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="whitespace-pre-wrap">{full}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (row) => {
        const full = row.remarks || "";
        if (!full) return "-";
        const truncated = truncateText(full);
        if (truncated === full) return full;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.descriptionCell}>{truncated}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="whitespace-pre-wrap">{full}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        if (row.status === "Completed") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Completed
            </Badge>
          );
        }
        if (row.status === "In Progress") {
          return (
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              In Progress
            </Badge>
          );
        }
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            Pending
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const resetForm = () => {
    setErrors({});
    setEditingReport(null);
    setSelectedEmployeeId("");
    setAssignmentDate(undefined);
    setDeadlineDate(undefined);
    setDaysForCompletion("");
    setDescription("");
    setStatus("");
    setRemarks("");
    setCompletionDate(undefined);
    setLastChangedField(null);
  };

  const handleEdit = (row) => {
    setEditingReport(row);
    setSelectedEmployeeId(row.employee?._id || "");
    setAssignmentDate(
      row.assignmentDate ? new Date(row.assignmentDate) : undefined,
    );
    setDeadlineDate(row.deadline ? new Date(row.deadline) : undefined);
    setDaysForCompletion(
      row.daysForCompletion ? String(row.daysForCompletion) : "",
    );
    setDescription(row.description || "");
    setStatus(row.status || "");
    setRemarks(row.remarks || "");
    setCompletionDate(
      row.completionDate ? new Date(row.completionDate) : undefined,
    );
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingReport(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingReport) {
      deleteMutation.mutate(deletingReport._id);
    }
  };

  const handleAddClick = () => {
    setDialogOpen(true);
  };

  // Search
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

  // Pagination
  const handleLimitChange = (value) => {
    setLimit(Number(value));
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // Date handlers with auto-calc
  const handleAssignmentDateSelect = (date) => {
    setAssignmentDate(date);
    setAssignDatePickerOpen(false);
    setLastChangedField("assignmentDate");
  };

  const handleDeadlineDateSelect = (date) => {
    setDeadlineDate(date);
    setDeadlineDatePickerOpen(false);
    setLastChangedField("deadline");
  };

  const handleDaysChange = (e) => {
    const val = e.target.value;
    // Allow only positive integers
    if (val === "" || /^\d+$/.test(val)) {
      setDaysForCompletion(val);
      setLastChangedField("days");
    }
  };

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (!selectedEmployeeId) {
      newErrors.employee = "Please select an employee";
    }

    if (!assignmentDate) {
      newErrors.assignmentDate = "Assignment date is required";
    }

    if (!deadlineDate) {
      newErrors.deadline = "Deadline is required";
    }

    if (assignmentDate && deadlineDate && deadlineDate <= assignmentDate) {
      newErrors.deadline = "Deadline must be after the assignment date";
    }

    const days = parseInt(daysForCompletion, 10);
    if (!days || days < 1) {
      newErrors.daysForCompletion = "Days for completion must be at least 1";
    }

    if (!description?.trim()) {
      newErrors.description = "Description is required";
    }

    // Edit-specific validations
    if (editingReport) {
      if (status === "Completed") {
        if (!completionDate) {
          newErrors.completionDate = "Completion date is required when status is Completed";
        }

        if (completionDate && assignmentDate && completionDate < assignmentDate) {
          newErrors.completionDate = "Completion date cannot be before assignment date";
        }

        if (!remarks?.trim()) {
          newErrors.remarks = "Remarks are required when marking as completed";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      employee: selectedEmployeeId,
      assignmentDate: assignmentDate.toISOString(),
      deadline: deadlineDate.toISOString(),
      daysForCompletion: days,
      description: description.trim(),
    };

    if (editingReport) {
      payload.status = status;
      if (status === "Completed") {
        payload.remarks = remarks.trim();
        if (completionDate) {
          payload.completionDate = completionDate.toISOString();
        }
      }
      updateMutation.mutate({ id: editingReport._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  const selectedEmployeeLabel = useMemo(() => {
    if (!selectedEmployeeId) return "";
    const emp = employeesList.find((e) => e._id === selectedEmployeeId);
    return emp ? `${emp.fullName} (${emp.employeeID})` : "";
  }, [selectedEmployeeId, employeesList]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Work Progress Reports</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTimeout(() => {
                resetForm();
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddClick}
          >
            <PlusIcon size={16} />
            Assign Task
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingReport ? "Edit Task" : "Assign Task"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingReport
                  ? "Edit the task details below"
                  : "Assign a new task to an employee"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                {/* Employee Selection (Combobox) */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Employee</Label>
                  <Popover
                    open={employeeComboboxOpen}
                    onOpenChange={setEmployeeComboboxOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={employeeComboboxOpen}
                        className="w-full justify-between font-normal cursor-pointer"
                      >
                        {selectedEmployeeLabel || "Search employee..."}
                        <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by name or ID..." />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employeesList.map((emp) => (
                              <CommandItem
                                key={emp._id}
                                value={`${emp.fullName} ${emp.employeeID}`}
                                onSelect={() => {
                                  setSelectedEmployeeId(
                                    emp._id === selectedEmployeeId
                                      ? ""
                                      : emp._id,
                                  );
                                  setEmployeeComboboxOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedEmployeeId === emp._id
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
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.employee && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.employee}
                    </p>
                  )}
                </div>

                {/* Assignment Date */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Assignment Date</Label>
                  <Popover
                    open={assignDatePickerOpen}
                    onOpenChange={setAssignDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal cursor-pointer",
                          !assignmentDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {assignmentDate
                          ? formatDate(assignmentDate)
                          : "Pick assignment date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignmentDate}
                        onSelect={handleAssignmentDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.assignmentDate && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.assignmentDate}
                    </p>
                  )}
                </div>

                {/* Deadline Date */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Deadline</Label>
                  <Popover
                    open={deadlineDatePickerOpen}
                    onOpenChange={setDeadlineDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal cursor-pointer",
                          !deadlineDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadlineDate
                          ? formatDate(deadlineDate)
                          : "Pick deadline date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadlineDate}
                        onSelect={handleDeadlineDateSelect}
                        disabled={(date) =>
                          assignmentDate ? date <= assignmentDate : false
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.deadline && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.deadline}
                    </p>
                  )}
                </div>

                {/* Days for Completion */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">
                    Days for Completion
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Auto-calculated or enter days"
                    value={daysForCompletion}
                    onChange={handleDaysChange}
                  />
                  {errors.daysForCompletion && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.daysForCompletion}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Description</Label>
                  <Textarea
                    placeholder="Enter task description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                  {errors.description && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.description}
                    </p>
                  )}
                </div>

                {/* Edit-only fields: Status, Completion Date & Remarks */}
                {editingReport && (
                  <>
                    {/* Status Dropdown */}
                    <div className="grid gap-3">
                      <Label className="text-[#344054]">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In Progress">
                              In Progress
                            </SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Completion Date */}
                    <div className="grid gap-3">
                      <Label className="text-[#344054]">
                        Completion Date{" "}
                        {status === "Completed" && (
                          <span className="text-red-500">*</span>
                        )}
                      </Label>
                      <Popover
                        open={completionDatePickerOpen}
                        onOpenChange={setCompletionDatePickerOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            disabled={status !== "Completed"}
                            className={cn(
                              "w-full justify-start text-left font-normal cursor-pointer",
                              !completionDate && "text-muted-foreground",
                              status !== "Completed" && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {completionDate
                              ? formatDate(completionDate)
                              : status === "Completed"
                              ? "Pick completion date"
                              : "Select Completed status to enable"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={completionDate}
                            onSelect={(date) => {
                              setCompletionDate(date);
                              setCompletionDatePickerOpen(false);
                            }}
                            disabled={(date) =>
                              assignmentDate ? date < assignmentDate : false
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.completionDate && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.completionDate}
                        </p>
                      )}
                    </div>

                    {/* Remarks */}
                    <div className="grid gap-3">
                      <Label className="text-[#344054]">
                        Remarks{" "}
                        {status === "Completed" && (
                          <span className="text-red-500">*</span>
                        )}
                      </Label>
                      <Textarea
                        placeholder={
                          status === "Completed"
                            ? "Enter remarks..."
                            : "Select Completed status to enable"
                        }
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        disabled={status !== "Completed"}
                        rows={3}
                        className={cn(
                          status !== "Completed" && "cursor-not-allowed opacity-50",
                        )}
                      />
                      {errors.remarks && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.remarks}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant="green"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingReport ? "Updating" : "Assigning"}
                    </>
                  ) : editingReport ? (
                    "Update"
                  ) : (
                    "Assign"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by employee name, ID, or description..."
            value={searchValue}
            onChange={handleSearchChange}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="cursor-pointer hover:text-[#02542D]"
            onClick={handleClearSearch}
          >
            {isFetching && debouncedSearch ? <Spinner /> : <CircleXIcon />}
          </InputGroupAddon>
        </InputGroup>

        <Select
          value={limit.toString()}
          onValueChange={handleLimitChange}
          className={styles.pageLimitSelect}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Select page limit" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="5">5 items</SelectItem>
              <SelectItem value="10">10 items</SelectItem>
              <SelectItem value="25">25 items</SelectItem>
              <SelectItem value="50">50 items</SelectItem>
              <SelectItem value="100">100 items</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.workProgressReports || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading work progress reports..."
      />

      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination className="pt-5">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault();
                  handlePreviousPage();
                }}
                className={
                  page === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>

            {(() => {
              const { currentPage, totalPages } = data.pagination;
              const pages = [];

              pages.push(
                <PaginationItem key={1}>
                  <PaginationLink
                    onClick={(e) => {
                      e.preventDefault();
                      handlePageChange(1);
                    }}
                    isActive={currentPage === 1}
                    className="cursor-pointer"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>,
              );

              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              for (
                let i = Math.max(2, currentPage - 1);
                i <= Math.min(totalPages - 1, currentPage + 1);
                i++
              ) {
                pages.push(
                  <PaginationItem key={i}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(i);
                      }}
                      isActive={currentPage === i}
                      className="cursor-pointer"
                    >
                      {i}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
                );
              }

              if (totalPages > 1) {
                pages.push(
                  <PaginationItem key={totalPages}>
                    <PaginationLink
                      onClick={(e) => {
                        e.preventDefault();
                        handlePageChange(totalPages);
                      }}
                      isActive={currentPage === totalPages}
                      className="cursor-pointer"
                    >
                      {totalPages}
                    </PaginationLink>
                  </PaginationItem>,
                );
              }

              return pages;
            })()}

            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault();
                  handleNextPage();
                }}
                className={
                  page === data.pagination.totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingReport(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Task
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the task assigned to{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingReport?.employee?.fullName}"
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/70 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 cursor-pointer"
            >
              {deleteMutation.isPending ? (
                <>
                  <Spinner />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkProgressReports;