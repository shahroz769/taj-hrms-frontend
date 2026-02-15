// React
import React, { useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// Redux
import { useSelector } from "react-redux";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import XCircleIcon from "lucide-react/dist/esm/icons/x-circle";
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
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Services
import {
  fetchLeaveApplications,
  createLeaveApplication,
  updateLeaveApplication,
  approveLeaveApplication,
  rejectLeaveApplication,
  deleteLeaveApplication,
  fetchEmployeeLeaveBalance,
} from "@/services/leaveApplicationsApi";
import { fetchEmployeesList } from "@/services/employeesApi";
import { fetchLeaveTypesList } from "@/services/leaveTypesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";
import { ROLES } from "@/utils/roles";
import { cn } from "@/lib/utils";

// Styles
import styles from "./LeavesApplications.module.css";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate all dates between start and end (inclusive).
 */
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

// ============================================================================
// COMPONENT
// ============================================================================

const LeavesApplications = () => {
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
  // AUTH
  // ===========================================================================
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === ROLES.admin;

  // ===========================================================================
  // STATE
  // ===========================================================================
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingApplication, setEditingApplication] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingApplication, setDeletingApplication] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState("");
  const [dateRanges, setDateRanges] = useState([
    { startDate: undefined, endDate: undefined },
  ]);
  const [reason, setReason] = useState("");
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [datePickerOpenIndex, setDatePickerOpenIndex] = useState(null);
  const [datePickerType, setDatePickerType] = useState(null); // 'start' or 'end'

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  useEffect(() => {
    const params = {};
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // Fetch Leave Applications (paginated)
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["leave-applications", { limit, page, search: debouncedSearch }],
    queryFn: () =>
      fetchLeaveApplications({ limit, page, search: debouncedSearch }),
  });

  // Fetch Employees List (for combobox)
  const { data: employeesData } = useQuery({
    queryKey: ["employees-list"],
    queryFn: fetchEmployeesList,
    enabled: dialogOpen,
  });

  // Fetch Leave Types List (for dropdown)
  const { data: leaveTypesData } = useQuery({
    queryKey: ["leave-types-list"],
    queryFn: fetchLeaveTypesList,
    enabled: dialogOpen,
  });

  // Fetch Employee Leave Balance
  const { data: balanceData, isPending: balanceLoading } = useQuery({
    queryKey: ["employee-leave-balance", selectedEmployeeId],
    queryFn: () => fetchEmployeeLeaveBalance(selectedEmployeeId),
    enabled: dialogOpen && !!selectedEmployeeId,
  });

  const employeesList = useMemo(
    () => employeesData?.employees || [],
    [employeesData]
  );
  const leaveTypesList = useMemo(
    () => leaveTypesData || [],
    [leaveTypesData]
  );
  const balances = useMemo(
    () => balanceData?.balances || [],
    [balanceData]
  );

  // ===========================================================================
  // COMPUTED
  // ===========================================================================

  // Calculate total days from all date ranges
  const totalDays = useMemo(() => {
    return generateDatesFromRanges(dateRanges).length;
  }, [dateRanges]);

  // Get remaining balance for the selected leave type
  const selectedLeaveBalance = useMemo(() => {
    if (!selectedLeaveTypeId || balances.length === 0) return null;
    return balances.find(
      (b) => b.leaveType._id === selectedLeaveTypeId
    );
  }, [selectedLeaveTypeId, balances]);

  // Check if days exceed balance
  const exceedsBalance = useMemo(() => {
    if (!selectedLeaveBalance) return false;
    return totalDays > selectedLeaveBalance.remainingDays;
  }, [totalDays, selectedLeaveBalance]);

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  const createMutation = useMutation({
    mutationFn: createLeaveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["employee-leave-balance"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Leave application submitted successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to submit leave application";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLeaveApplication(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["employee-leave-balance"] });
      resetForm();
      setDialogOpen(false);
      toast.success("Leave application updated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update leave application";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeaveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["employee-leave-balance"] });
      setDeleteDialogOpen(false);
      setDeletingApplication(null);
      toast.success("Leave application deleted successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to delete leave application";
      toast.error(errorMessage);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveLeaveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["employee-leave-balance"] });
      toast.success("Leave application approved");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to approve leave application";
      toast.error(errorMessage);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectLeaveApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["employee-leave-balance"] });
      toast.success("Leave application rejected");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to reject leave application";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE COLUMNS
  // ===========================================================================
  const columns = [
    {
      key: "employeeName",
      label: "Employee Name",
      fontWeight: "medium",
      render: (row) => row.employee?.fullName || "-",
    },
    {
      key: "employeeID",
      label: "Employee ID",
      render: (row) => row.employee?.employeeID || "-",
    },
    {
      key: "leaveType",
      label: "Leave Type",
      render: (row) => row.leaveType?.name || "-",
    },
    {
      key: "reason",
      label: "Reason",
      render: (row) => {
        const reason = row.reason || "-";
        if (reason === "-") return "-";
        const words = reason.split(" ");
        const preview = words.slice(0, 2).join(" ");
        const needsTooltip = words.length > 2;
        
        if (needsTooltip) {
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{preview}...</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{reason}</p>
              </TooltipContent>
            </Tooltip>
          );
        }
        return preview;
      },
    },
    {
      key: "days",
      label: "Days",
      render: (row) => {
        const datesArr = row.dates || [];
        const formatted = datesArr.map((d) => formatDate(d)).join("\n");
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={styles.daysCell}>
                {row.daysCount || datesArr.length}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="whitespace-pre-wrap text-xs">{formatted || "-"}</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        if (row.status === "Approved") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Approved
            </Badge>
          );
        }
        if (row.status === "Pending") {
          return (
            <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
              Pending
            </Badge>
          );
        }
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            Rejected
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
      renderApprove: (row) => {
        if (!isAdmin) return null;
        if (row.status === "Approved") return null;
        return <CircleCheckIcon size={18} className="text-green-600" />;
      },
      renderReject: (row) => {
        if (!isAdmin) return null;
        if (row.status === "Rejected") return null;
        return <XCircleIcon size={18} className="text-red-500" />;
      },
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const resetForm = () => {
    setErrors({});
    setEditingApplication(null);
    setSelectedEmployeeId("");
    setSelectedLeaveTypeId("");
    setDateRanges([{ startDate: undefined, endDate: undefined }]);
    setReason("");
  };

  const handleEdit = (row) => {
    setEditingApplication(row);
    setSelectedEmployeeId(row.employee?._id || "");
    setSelectedLeaveTypeId(row.leaveType?._id || "");
    // Restore date ranges
    if (row.dateRanges && row.dateRanges.length > 0) {
      setDateRanges(
        row.dateRanges.map((r) => ({
          startDate: r.startDate ? new Date(r.startDate) : undefined,
          endDate: r.endDate ? new Date(r.endDate) : undefined,
        }))
      );
    } else {
      setDateRanges([{ startDate: undefined, endDate: undefined }]);
    }
    setReason(row.reason || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingApplication(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingApplication) {
      deleteMutation.mutate(deletingApplication._id);
    }
  };

  const handleApprove = (row) => {
    approveMutation.mutate(row._id);
  };

  const handleReject = (row) => {
    rejectMutation.mutate(row._id);
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

  // Date range handlers
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
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (!selectedEmployeeId) {
      newErrors.employee = "Please select an employee";
    }

    if (!selectedLeaveTypeId) {
      newErrors.leaveType = "Please select a leave type";
    }

    // Validate date ranges
    const hasValidRange = dateRanges.some(
      (r) => r.startDate && r.endDate
    );
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

    if (exceedsBalance) {
      newErrors.balance = "Leave days exceed available balance";
    }

    if (totalDays === 0) {
      newErrors.dateRanges = "Please select valid date ranges";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Build payload — only send complete ranges
    const validRanges = dateRanges
      .filter((r) => r.startDate && r.endDate)
      .map((r) => ({
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
      }));

    const payload = {
      employee: selectedEmployeeId,
      leaveType: selectedLeaveTypeId,
      dateRanges: validRanges,
      reason: reason.trim(),
    };

    if (editingApplication) {
      updateMutation.mutate({ id: editingApplication._id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const selectedEmployeeLabel = useMemo(() => {
    if (!selectedEmployeeId) return "";
    const emp = employeesList.find((e) => e._id === selectedEmployeeId);
    return emp ? `${emp.fullName} (${emp.employeeID})` : "";
  }, [selectedEmployeeId, employeesList]);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Leave Applications</h1>
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
            Apply Leave
          </Button>
          <DialogContent className="sm:max-w-140 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingApplication
                  ? "Edit Leave Application"
                  : "Apply for Leave"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingApplication
                  ? "Edit the leave application details below"
                  : "Apply for a leave on behalf of an employee"}
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
                                  const newId =
                                    emp._id === selectedEmployeeId
                                      ? ""
                                      : emp._id;
                                  setSelectedEmployeeId(newId);
                                  setSelectedLeaveTypeId("");
                                  setEmployeeComboboxOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <CheckIcon
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedEmployeeId === emp._id
                                      ? "opacity-100"
                                      : "opacity-0"
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

                {/* Leave Type Selection */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Leave Type</Label>
                  <Select
                    value={selectedLeaveTypeId}
                    onValueChange={(value) => setSelectedLeaveTypeId(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {leaveTypesList.map((lt) => (
                          <SelectItem key={lt._id} value={lt._id}>
                            {lt.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.leaveType && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.leaveType}
                    </p>
                  )}
                  {/* Live Balance Indicator */}
                  {selectedLeaveBalance && (
                    <div
                      className={
                        exceedsBalance
                          ? styles.liveBalanceWarn
                          : styles.liveBalanceOk
                      }
                    >
                      <span>
                        Available:{" "}
                        <strong>
                          {selectedLeaveBalance.remainingDays}
                        </strong>{" "}
                        days
                      </span>
                      {totalDays > 0 && (
                        <span>
                          {" "}
                          | Requesting: <strong>{totalDays}</strong> days
                          {exceedsBalance && " (exceeds balance)"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Date Ranges */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Date Range(s)</Label>
                  {dateRanges.map((range, index) => (
                    <div key={index} className={styles.dateRangeRow}>
                      <div className={styles.dateRangeFields}>
                        {/* Start Date */}
                        <Popover
                          open={
                            datePickerOpenIndex === index &&
                            datePickerType === "start"
                          }
                          onOpenChange={(open) => {
                            if (open) {
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
                                "w-full justify-start text-left font-normal cursor-pointer",
                                !range.startDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {range.startDate
                                ? formatDate(range.startDate)
                                : "Start date"}
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
                            datePickerOpenIndex === index &&
                            datePickerType === "end"
                          }
                          onOpenChange={(open) => {
                            if (open) {
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
                                "w-full justify-start text-left font-normal cursor-pointer",
                                !range.endDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {range.endDate
                                ? formatDate(range.endDate)
                                : "End date"}
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
                          variant="outline"
                          size="icon"
                          className="shrink-0 cursor-pointer text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeDateRange(index)}
                        >
                          <CircleXIcon size={16} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit cursor-pointer"
                    onClick={addDateRange}
                  >
                    <PlusIcon size={14} className="mr-1" />
                    Add Date Range
                  </Button>
                  {errors.dateRanges && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.dateRanges}
                    </p>
                  )}
                  {errors.balance && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.balance}
                    </p>
                  )}
                  {/* Days summary */}
                  {totalDays > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Total days: <strong>{totalDays}</strong>
                    </p>
                  )}
                </div>

                {/* Reason */}
                <div className="grid gap-3">
                  <Label className="text-[#344054]">Reason (Optional)</Label>
                  <Textarea
                    placeholder="Enter reason for leave..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
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
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    exceedsBalance
                  }
                  className="cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingApplication ? "Updating" : "Applying"}
                    </>
                  ) : editingApplication ? (
                    "Update"
                  ) : (
                    "Apply Leave"
                  )}
                </Button>
              </DialogFooter>
            </form>

            {/* Leave Balance Section */}
            {selectedEmployeeId && (
              <div className={styles.balanceSection}>
                <Separator className="my-4" />
                <div>
                  <h3 className="text-sm font-semibold text-[#02542D] mb-1">
                    Leave Balance
                  </h3>
                  {balanceData?.employee?.fullName && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {balanceData.employee.fullName} &mdash;{" "}
                      {balanceData.year}
                    </p>
                  )}
                  {balanceLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <Spinner className="h-4 w-4" />
                      <span className="text-sm text-muted-foreground">
                        Loading balance...
                      </span>
                    </div>
                  ) : balances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No leave balance found. Employee may not have an
                      approved leave policy assigned.
                    </p>
                  ) : (
                    <div className={styles.balanceGrid}>
                      {balances.map((b) => (
                        <div
                          key={b.leaveType._id}
                          className={styles.balanceItem}
                        >
                          <span className={styles.balanceItemName}>
                            {b.leaveType.name}
                          </span>
                          <span className={styles.balanceItemDays}>
                            {b.remainingDays}/{b.totalDays}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by employee name, ID, or leave type..."
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
        data={data?.leaveApplications || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading leave applications..."
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
                </PaginationItem>
              );

              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>
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
                  </PaginationItem>
                );
              }

              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>
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
                  </PaginationItem>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingApplication(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Leave Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the leave application for{" "}
              <span className="font-semibold text-[#02542D]">
                &quot;{deletingApplication?.employee?.fullName}&quot;
              </span>
              ? This action cannot be undone.
              {deletingApplication?.status !== "Rejected" && (
                <span className="block mt-1 text-sm">
                  The leave balance will be restored.
                </span>
              )}
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

export default LeavesApplications;