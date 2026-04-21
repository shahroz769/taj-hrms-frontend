// React
import { useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import XIcon from "lucide-react/dist/esm/icons/x";
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
  createDeduction,
  deleteDeduction,
  fetchDeductions,
  searchEmployeesForDeduction,
  updateDeduction,
  updateDeductionStatus,
} from "@/services/deductionsApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { ROLES } from "@/utils/roles";

// Styles
import styles from "./Deductions.module.css";

// ============================================================================
// HELPERS
// ============================================================================

const truncateReason = (text) => {
  if (!text) return "-";
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) return text;
  return words.slice(0, 2).join(" ") + "...";
};

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = CURRENT_YEAR - 2;
const YEARS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 2 },
  (_, index) => String(START_YEAR + index),
);
const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const STATUS_BADGE_CLASS = {
  Pending: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  Approved: "bg-green-100 text-green-700 hover:bg-green-100",
  Rejected: "bg-red-100 text-red-700 hover:bg-red-100",
  Deducted: "bg-blue-100 text-blue-700 hover:bg-blue-100",
};

// ============================================================================
// COMPONENT
// ============================================================================

const Deductions = () => {
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === ROLES.admin;

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
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDeduction, setDeletingDeduction] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Filters
  const [filterDepartment, setFilterDepartment] = useState(
    searchParams.get("department") || "",
  );
  const [filterPosition, setFilterPosition] = useState(
    searchParams.get("position") || "",
  );
  const [filterYear, setFilterYear] = useState(
    searchParams.get("year") || "",
  );
  const [filterMonth, setFilterMonth] = useState(
    searchParams.get("month") || "",
  );
  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [tempFilterYear, setTempFilterYear] = useState("");
  const [tempFilterMonth, setTempFilterMonth] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  // Form state
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [debouncedEmployeeQuery, setDebouncedEmployeeQuery] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [deductionDate, setDeductionDate] = useState(undefined);
  const [deductionReason, setDeductionReason] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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
    const timer = setTimeout(() => {
      setDebouncedEmployeeQuery(employeeSearchQuery.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [employeeSearchQuery]);

  useEffect(() => {
    const params = {};
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    if (filterDepartment) params.department = filterDepartment;
    if (filterPosition) params.position = filterPosition;
    if (filterYear) params.year = filterYear;
    if (filterMonth) params.month = filterMonth;
    setSearchParams(params, { replace: true });
  }, [
    limit,
    page,
    debouncedSearch,
    filterDepartment,
    filterPosition,
    filterYear,
    filterMonth,
    setSearchParams,
  ]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "deductions",
      {
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        year: filterYear,
        month: filterMonth,
      },
    ],
    queryFn: () =>
      fetchDeductions({
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        year: filterYear,
        month: filterMonth,
      }),
  });

  // Employee list for combobox
  const { data: employeesList = [], isFetching: isLoadingEmployees } = useQuery({
    queryKey: ["employees-list", debouncedEmployeeQuery],
    queryFn: () => searchEmployeesForDeduction(debouncedEmployeeQuery),
    enabled:
      dialogOpen &&
      employeeComboboxOpen &&
      debouncedEmployeeQuery.length >= 1,
    placeholderData: (previous) => previous,
  });

  // Filter data
  const {
    data: departmentsList,
    refetch: fetchDepartments,
    isLoading: isLoadingDepartments,
  } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: false,
  });

  const {
    data: positionsFilters,
    refetch: fetchPositions,
    isLoading: isLoadingPositions,
  } = useQuery({
    queryKey: ["positionsFilters"],
    queryFn: fetchPositionsFilters,
    enabled: false,
  });

  const uniquePositionNames = useMemo(() => {
    return (
      positionsFilters?.positionsFiltersList
        ?.map((position) => position.name)
        .filter((value, index, self) => self.indexOf(value) === index) || []
    );
  }, [positionsFilters]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: createDeduction,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["deductions"] });
      resetForm();
      setDialogOpen(false);
      toast.success(response.message || "Deduction(s) applied successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to apply deduction";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDeduction(id, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["deductions"] });
      resetForm();
      setDialogOpen(false);
      toast.success(response.message || "Deduction updated successfully");
      if (response.payrollExists) {
        toast.warning(
          "Payroll exists for this month. Please regenerate payroll to reflect changes.",
          { duration: 6000 },
        );
      }
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update deduction";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, payload }) => updateDeductionStatus(id, payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["deductions"] });
      toast.success(response.message || "Deduction status updated successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to update deduction status";
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeduction,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["deductions"] });
      setDeleteDialogOpen(false);
      setDeletingDeduction(null);
      toast.success(response.message || "Deduction deleted successfully");
      if (response.payrollExists) {
        toast.warning(
          "Payroll exists for this month. Please regenerate payroll to reflect changes.",
          { duration: 6000 },
        );
      }
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to delete deduction";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE
  // ===========================================================================
  const canManageDeduction = (row) =>
    row.status !== "Deducted" && (isAdmin || row.status === "Pending");
  const canApproveDeduction = (row) =>
    isAdmin && row.status !== "Deducted";
  const canRejectDeduction = (row) =>
    isAdmin && row.status !== "Deducted";

  const columns = [
    {
      key: "employeeName",
      label: "Employee",
      fontWeight: "medium",
      render: (row) => {
        const name = row.employee?.fullName || "-";
        const id = row.employee?.employeeID || "";
        return id ? `${name} (${id})` : name;
      },
    },
    {
      key: "department",
      label: "Department",
      render: (row) => row.employeeDepartment?.name || "-",
    },
    {
      key: "position",
      label: "Position",
      render: (row) => row.employeePosition?.name || "-",
    },
    {
      key: "amount",
      label: "Amount",
      render: (row) =>
        `PKR ${Number(row.amount || 0).toLocaleString()}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const status = row.status || "Pending";
        return (
          <Badge
            className={
              STATUS_BADGE_CLASS[status] ||
              "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      key: "date",
      label: "Date",
      render: (row) => (row.date ? formatDate(row.date) : "-"),
    },
    {
      key: "dueMonth",
      label: "Current Due",
      render: (row) =>
        row.currentDueYear && row.currentDueMonth
          ? `${MONTHS.find((item) => Number(item.value) === Number(row.currentDueMonth))?.label || row.currentDueMonth} ${row.currentDueYear}`
          : "-",
    },
    {
      key: "reason",
      label: "Reason",
      render: (row) => {
        const full = row.reason || "";
        const truncated = truncateReason(full);
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
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: (row) => {
        if (!canManageDeduction(row)) return null;
        return <PencilIcon size={18} />;
      },
      renderDelete: (row) => {
        if (!canManageDeduction(row)) return null;
        return <TrashIcon size={18} />;
      },
      renderApprove: (row) => {
        if (!canApproveDeduction(row)) return null;
        return <CircleCheckIcon size={18} className="text-green-600" />;
      },
      renderReject: (row) => {
        if (!canRejectDeduction(row)) return null;
        return <XCircleIcon size={18} className="text-red-500" />;
      },
    },
  ];

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const resetForm = () => {
    setErrors({});
    setEditingDeduction(null);
    setSelectedEmployees([]);
    setEmployeeSearchQuery("");
    setDebouncedEmployeeQuery("");
    setDeductionAmount("");
    setDeductionDate(undefined);
    setDeductionReason("");
  };

  const handleEdit = (row) => {
    if (!canManageDeduction(row)) {
      toast.error(
        row.status === "Deducted"
          ? "Paid deductions cannot be edited"
          : "Supervisors can only edit deductions while they are pending approval",
      );
      return;
    }

    setEditingDeduction(row);
    setSelectedEmployees(
      row.employee
        ? [
            {
              _id: row.employee._id,
              fullName: row.employee.fullName,
              employeeID: row.employee.employeeID,
            },
          ]
        : [],
    );
    setDeductionAmount(String(row.amount || ""));
    setDeductionDate(row.date ? new Date(row.date) : undefined);
    setDeductionReason(row.reason || "");
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    if (!canManageDeduction(row)) {
      toast.error(
        row.status === "Deducted"
          ? "Paid deductions cannot be deleted"
          : "Supervisors can only delete deductions while they are pending approval",
      );
      return;
    }

    setDeletingDeduction(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingDeduction) {
      deleteMutation.mutate(deletingDeduction._id);
    }
  };

  const handleAddClick = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleApprove = (row) => {
    updateStatusMutation.mutate({
      id: row._id,
      payload: { status: "Approved" },
    });
  };

  const handleReject = (row) => {
    updateStatusMutation.mutate({
      id: row._id,
      payload: { status: "Rejected" },
    });
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

  // Filters
  const handleFilterPopoverOpenChange = (open) => {
    setFilterPopoverOpen(open);
  };

  const handleFilterClick = async (event) => {
    event.preventDefault();
    setIsFiltersLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchPositions()]);
      setTempFilterDepartment(filterDepartment);
      setTempFilterPosition(filterPosition);
      setTempFilterYear(filterYear);
      setTempFilterMonth(filterMonth);
      setFilterPopoverOpen(true);
    } catch {
      toast.error("Failed to load filters");
    } finally {
      setIsFiltersLoading(false);
    }
  };

  const applyFilters = () => {
    setFilterDepartment(tempFilterDepartment);
    setFilterPosition(tempFilterPosition);
    setFilterYear(tempFilterYear);
    setFilterMonth(tempFilterMonth);
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const resetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setTempFilterYear("");
    setTempFilterMonth("");
    setFilterDepartment("");
    setFilterPosition("");
    setFilterYear("");
    setFilterMonth("");
    setPage(1);
    setFilterPopoverOpen(false);
  };

  // Employee selection
  const toggleEmployee = (empId) => {
    setSelectedEmployees((prev) => {
      const exists = prev.some((e) => e._id === empId);
      if (exists) {
        return prev.filter((e) => e._id !== empId);
      }
      const emp = employeesList.find((e) => e._id === empId);
      return emp ? [...prev, emp] : prev;
    });
  };

  const selectedEmployeeLabels = useMemo(() => {
    return selectedEmployees
      .map((emp) => `${emp.fullName} (${emp.employeeID})`)
      .join(", ");
  }, [selectedEmployees]);

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};

    if (selectedEmployees.length === 0) {
      newErrors.employee = "Please select at least one employee";
    }

    const parsedAmount = Number(deductionAmount);
    if (!deductionAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = "Amount must be a positive number greater than zero";
    }

    if (!deductionDate) {
      newErrors.date = "Date is required";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(deductionDate);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today && !editingDeduction) {
        newErrors.date = "Date cannot be in the past";
      }
    }

    if (!deductionReason?.trim()) {
      newErrors.reason = "Reason is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingDeduction) {
      const payload = {
        employee: selectedEmployees[0]._id,
        amount: parsedAmount,
        date: deductionDate.toISOString(),
        reason: deductionReason.trim(),
      };
      updateMutation.mutate({ id: editingDeduction._id, payload });
    } else {
      const payload = {
        employees: selectedEmployees.map((e) => e._id),
        amount: parsedAmount,
        date: deductionDate.toISOString(),
        reason: deductionReason.trim(),
      };
      createMutation.mutate(payload);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Deductions</h1>
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
            Apply Deduction
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-primary">
                {editingDeduction ? "Edit Deduction" : "Apply Deduction"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingDeduction
                  ? "Edit the deduction details below"
                  : "Apply a new deduction to selected employees"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {editingDeduction
                  ? isAdmin
                    ? "Admins can update any deduction record directly."
                    : "Supervisors can only update deductions while they remain pending approval."
                  : isAdmin
                    ? "Admin-created deductions are approved immediately."
                    : "Supervisor-created deductions are submitted as Pending until an admin reviews them."}
              </div>
              <div className="grid gap-4">
                {/* Employee Multi-select — Command Combobox */}
                <div className="grid gap-3">
                  <Label className="text-foreground">
                    Employee{" "}
                    {selectedEmployees.length > 0 && (
                      <Badge className="ml-1 bg-primary text-white text-[10px] h-4 px-1.5">
                        {selectedEmployees.length}
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
                          {selectedEmployees.length === 0
                            ? "Search and select employees..."
                            : selectedEmployees.length === 1
                              ? selectedEmployeeLabels
                              : `${selectedEmployees.length} employees selected`}
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
                                      selectedEmployees.some(
                                        (e) => e._id === emp._id,
                                      )
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
                  {/* Selected pills */}
                  {selectedEmployees.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedEmployees.map((emp) => (
                        <Badge
                          key={emp._id}
                          className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100 gap-1 pr-1"
                        >
                          {emp.fullName} ({emp.employeeID})
                          <button
                            type="button"
                            className="ml-0.5 rounded-full hover:bg-green-200 p-0.5 cursor-pointer"
                            onClick={() =>
                              setSelectedEmployees((prev) =>
                                prev.filter((e) => e._id !== emp._id),
                              )
                            }
                          >
                            <XIcon size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {errors.employee && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.employee}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div className="grid gap-3">
                  <Label className="text-foreground">Amount (PKR)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Enter deduction amount"
                    value={deductionAmount}
                    onChange={(e) => setDeductionAmount(e.target.value)}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.amount}
                    </p>
                  )}
                </div>

                {/* Date */}
                <div className="grid gap-3">
                  <Label className="text-foreground">Deduction Date</Label>
                  <Popover
                    open={datePickerOpen}
                    onOpenChange={setDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal cursor-pointer",
                          !deductionDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deductionDate
                          ? formatDate(deductionDate)
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deductionDate}
                        onSelect={(date) => {
                          setDeductionDate(date);
                          setDatePickerOpen(false);
                        }}
                        disabled={(date) => {
                          if (editingDeduction) return false;
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          return date < today;
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && (
                    <p className="text-sm text-red-500 mt-1">{errors.date}</p>
                  )}
                </div>

                {/* Reason */}
                <div className="grid gap-3">
                  <Label className="text-foreground">Reason</Label>
                  <Textarea
                    placeholder="Enter reason for the deduction..."
                    value={deductionReason}
                    onChange={(e) => setDeductionReason(e.target.value)}
                    rows={3}
                  />
                  {errors.reason && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.reason}
                    </p>
                  )}
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
                    createMutation.isPending || updateMutation.isPending
                  }
                  className="cursor-pointer"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingDeduction ? "Updating" : "Applying"}
                    </>
                  ) : editingDeduction ? (
                    "Update"
                  ) : (
                    "Apply Deduction"
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
            placeholder="Search by employee name or ID..."
            value={searchValue}
            onChange={handleSearchChange}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupAddon
            align="inline-end"
            className="cursor-pointer hover:text-primary"
            onClick={handleClearSearch}
          >
            {isFetching && debouncedSearch ? <Spinner /> : <CircleXIcon />}
          </InputGroupAddon>
        </InputGroup>

        <Select
          value={limit.toString()}
          onValueChange={handleLimitChange}
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

        {/* Filters */}
        <Popover
          open={filterPopoverOpen}
          onOpenChange={handleFilterPopoverOpenChange}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
              disabled={isFiltersLoading}
              onClick={handleFilterClick}
            >
              {isFiltersLoading ? <Spinner /> : <SlidersHorizontalIcon />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            {isLoadingDepartments || isLoadingPositions ? (
              <div className="flex items-center justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="leading-none font-medium">Filters</h4>
                  <p className="text-muted-foreground text-sm">
                    Apply the filters for deduction records.
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Department</Label>
                    <Select
                      value={tempFilterDepartment || "all"}
                      onValueChange={(value) =>
                        setTempFilterDepartment(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departmentsList?.map((dept) => (
                            <SelectItem key={dept._id} value={dept.name}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Position</Label>
                    <Select
                      value={tempFilterPosition || "all"}
                      onValueChange={(value) =>
                        setTempFilterPosition(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All positions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Positions</SelectItem>
                          {uniquePositionNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Year</Label>
                    <Select
                      value={tempFilterYear || "all"}
                      onValueChange={(value) =>
                        setTempFilterYear(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Years</SelectItem>
                          {YEARS.map((yearOption) => (
                            <SelectItem key={yearOption} value={yearOption}>
                              {yearOption}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Month</Label>
                    <Select
                      value={tempFilterMonth || "all"}
                      onValueChange={(value) =>
                        setTempFilterMonth(value === "all" ? "" : value)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All months" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Months</SelectItem>
                          {MONTHS.map((monthOption) => (
                            <SelectItem
                              key={monthOption.value}
                              value={monthOption.value}
                            >
                              {monthOption.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="green"
                    className="cursor-pointer flex-1"
                    onClick={applyFilters}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    className="cursor-pointer flex-1"
                    onClick={resetFilters}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        data={data?.deductions || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        approveLabel="Approve"
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading deductions..."
      />

      {data?.pagination && (
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

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingDeduction(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              Delete Deduction
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the deduction of{" "}
              <span className="font-semibold text-primary">
                PKR {Number(deletingDeduction?.amount || 0).toLocaleString()}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-primary">
                "{deletingDeduction?.employee?.fullName}"
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

export default Deductions;
