// React
import { useCallback, useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import CheckIcon from "lucide-react/dist/esm/icons/check";
import ChevronsUpDownIcon from "lucide-react/dist/esm/icons/chevrons-up-down";
import CircleCheckIcon from "lucide-react/dist/esm/icons/circle-check";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import EyeIcon from "lucide-react/dist/esm/icons/eye";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import TrashIcon from "lucide-react/dist/esm/icons/trash";
import XCircleIcon from "lucide-react/dist/esm/icons/x-circle";
import XIcon from "lucide-react/dist/esm/icons/x";
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// Services
import {
  fetchLoans,
  searchEmployeesForLoan,
  fetchLoanDetails,
  createLoan,
  approveLoan,
  rejectLoan,
  settleLoan,
  deleteLoan,
} from "@/services/loansApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";

// Utils
import { formatDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { ROLES } from "@/utils/roles";

// Styles
import styles from "./Loans.module.css";

// ============================================================================
// HELPERS
// ============================================================================

const currency = (val) =>
  `PKR ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const REPAYMENT_LABELS = {
  fixed_amount: "Fixed Amount",
  fixed_months: "Fixed Months",
  next_salary: "Next Salary",
};

const STATUS_BADGE_CLASS = {
  Pending: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  Approved: "bg-green-100 text-green-700 hover:bg-green-100",
  Rejected: "bg-red-100 text-red-700 hover:bg-red-100",
  Completed: "bg-blue-100 text-blue-700 hover:bg-blue-100",
};

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = new Date().getFullYear();
const START_YEAR = CURRENT_YEAR - 2;
const YEARS = Array.from(
  { length: CURRENT_YEAR - START_YEAR + 2 },
  (_, i) => String(START_YEAR + i),
);

// ============================================================================
// COMPONENT
// ============================================================================

const Loans = () => {
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
  const getInitialSearch = () => searchParams.get("search") || "";

  // ===========================================================================
  // STATE
  // ===========================================================================
  const userRole = useSelector((state) => state.auth.user?.role);
  const isAdmin = userRole === ROLES.admin;

  // List state
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
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "",
  );
  const [filterYear, setFilterYear] = useState(
    searchParams.get("year") || "",
  );
  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [tempFilterStatus, setTempFilterStatus] = useState("");
  const [tempFilterYear, setTempFilterYear] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  // Create dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeComboboxOpen, setEmployeeComboboxOpen] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [debouncedEmployeeQuery, setDebouncedEmployeeQuery] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [repaymentType, setRepaymentType] = useState("");
  const [monthlyInstallment, setMonthlyInstallment] = useState("");
  const [totalMonths, setTotalMonths] = useState("");
  const [loanReason, setLoanReason] = useState("");
  const [errors, setErrors] = useState({});

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewingLoanId, setViewingLoanId] = useState(null);
  const [loadingLoanId, setLoadingLoanId] = useState(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLoan, setDeletingLoan] = useState(null);

  // Settle dialog
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settlingLoan, setSettlingLoan] = useState(null);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchValue), 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (searchValue !== "") setPage(1);
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
    if (filterStatus) params.status = filterStatus;
    if (filterYear) params.year = filterYear;
    setSearchParams(params, { replace: true });
  }, [
    limit,
    page,
    debouncedSearch,
    filterDepartment,
    filterPosition,
    filterStatus,
    filterYear,
    setSearchParams,
  ]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "loans",
      {
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        year: filterYear,
      },
    ],
    queryFn: () =>
      fetchLoans({
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        year: filterYear,
      }),
  });

  // Employee search for create dialog
  const { data: employeesList = [], isFetching: isLoadingEmployees } =
    useQuery({
      queryKey: ["employees-for-loan", debouncedEmployeeQuery],
      queryFn: () => searchEmployeesForLoan(debouncedEmployeeQuery),
      enabled:
        createDialogOpen &&
        employeeComboboxOpen &&
        debouncedEmployeeQuery.length >= 1,
      placeholderData: (prev) => prev,
    });

  // Loan details for view dialog (data is pre-fetched via handleEdit)
  const { data: loanDetailsData } =
    useQuery({
      queryKey: ["loan-details", viewingLoanId],
      queryFn: () => fetchLoanDetails(viewingLoanId),
      enabled: Boolean(viewingLoanId),
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
        ?.map((p) => p.name)
        .filter((v, i, a) => a.indexOf(v) === i) || []
    );
  }, [positionsFilters]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: createLoan,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      resetCreateForm();
      setCreateDialogOpen(false);
      toast.success(response.message || "Loan(s) created successfully");
      if (response.errors?.length > 0) {
        response.errors.forEach((err) => toast.warning(err.message));
      }
    },
    onError: (error) => {
      const msg = error.response?.data?.message || "Failed to create loan";
      setErrors({ server: msg });
      toast.error(msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: approveLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-details"] });
      toast.success("Loan approved");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to approve loan");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: rejectLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-details"] });
      toast.success("Loan rejected");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to reject loan");
    },
  });

  const settleMutation = useMutation({
    mutationFn: settleLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan-details"] });
      setSettleDialogOpen(false);
      setSettlingLoan(null);
      toast.success("Loan settled (early)");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to settle loan");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLoan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      setDeleteDialogOpen(false);
      setDeletingLoan(null);
      toast.success("Loan deleted");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete loan");
    },
  });

  // ===========================================================================
  // TABLE
  // ===========================================================================
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
      key: "loanAmount",
      label: "Loan Amount",
      render: (row) => currency(row.loanAmount),
    },
    {
      key: "repaymentType",
      label: "Repayment",
      render: (row) => REPAYMENT_LABELS[row.repaymentType] || row.repaymentType,
    },
    {
      key: "remaining",
      label: "Remaining",
      render: (row) => currency(row.remainingBalance),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <Badge className={STATUS_BADGE_CLASS[row.status] || "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: (row) =>
        loadingLoanId === row._id ? (
          <Spinner className="h-4.5 w-4.5" />
        ) : (
          <EyeIcon size={18} className="text-muted-foreground" />
        ),
      renderDelete: (row) => {
        if (!isAdmin) return null;
        const canDelete =
          row.status === "Pending" ||
          row.status === "Rejected" ||
          (row.status === "Approved" && Number(row.totalPaid || 0) === 0);
        if (!canDelete) return null;
        return <TrashIcon size={18} />;
      },
      renderApprove: (row) => {
        if (!isAdmin) return null;
        if (row.status !== "Pending") return null;
        return <CircleCheckIcon size={18} className="text-green-600" />;
      },
      renderReject: (row) => {
        if (!isAdmin) return null;
        if (row.status !== "Pending") return null;
        return <XCircleIcon size={18} className="text-red-500" />;
      },
    },
  ];

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const resetCreateForm = useCallback(() => {
    setErrors({});
    setSelectedEmployees([]);
    setEmployeeSearchQuery("");
    setDebouncedEmployeeQuery("");
    setLoanAmount("");
    setRepaymentType("");
    setMonthlyInstallment("");
    setTotalMonths("");
    setLoanReason("");
  }, []);

  // View loan — fetch first, then open dialog
  const handleEdit = async (row) => {
    if (loadingLoanId) return;
    setLoadingLoanId(row._id);
    try {
      await queryClient.fetchQuery({
        queryKey: ["loan-details", row._id],
        queryFn: () => fetchLoanDetails(row._id),
      });
      setViewingLoanId(row._id);
      setViewDialogOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load loan details");
    } finally {
      setLoadingLoanId(null);
    }
  };

  // Delete
  const handleDelete = (row) => {
    setDeletingLoan(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingLoan) deleteMutation.mutate(deletingLoan._id);
  };

  // Approve / Reject from table
  const handleApprove = (row) => approveMutation.mutate(row._id);
  const handleReject = (row) => rejectMutation.mutate(row._id);

  // Search
  const handleSearchChange = (e) => setSearchValue(e.target.value);

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
  const handlePageChange = (newPage) => setPage(newPage);
  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };
  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) setPage(page + 1);
  };

  // Filters
  const handleFilterClick = async (event) => {
    event.preventDefault();
    setIsFiltersLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchPositions()]);
      setTempFilterDepartment(filterDepartment);
      setTempFilterPosition(filterPosition);
      setTempFilterStatus(filterStatus);
      setTempFilterYear(filterYear);
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
    setFilterStatus(tempFilterStatus);
    setFilterYear(tempFilterYear);
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const resetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setTempFilterStatus("");
    setTempFilterYear("");
    setFilterDepartment("");
    setFilterPosition("");
    setFilterStatus("");
    setFilterYear("");
    setPage(1);
    setFilterPopoverOpen(false);
  };

  // Employee selection
  const toggleEmployee = (empId) => {
    setSelectedEmployees((prev) => {
      const exists = prev.some((e) => e._id === empId);
      if (exists) return prev.filter((e) => e._id !== empId);
      const emp = employeesList.find((e) => e._id === empId);
      return emp ? [...prev, emp] : prev;
    });
  };

  const selectedEmployeeLabels = useMemo(
    () =>
      selectedEmployees
        .map((emp) => `${emp.fullName} (${emp.employeeID})`)
        .join(", "),
    [selectedEmployees],
  );

  // Breakdown preview
  const breakdownPreview = useMemo(() => {
    const amount = Number(loanAmount);
    if (!amount || amount <= 0 || !repaymentType) return null;

    if (repaymentType === "fixed_amount") {
      const inst = Math.floor(Number(monthlyInstallment));
      if (!inst || inst <= 0) return null;
      const months = Math.ceil(amount / inst);
      const lastInstallment = amount - inst * (months - 1);
      return {
        monthlyInstallment: inst,
        totalMonths: months,
        lastInstallment: lastInstallment > 0 ? lastInstallment : inst,
      };
    }
    if (repaymentType === "fixed_months") {
      const months = Number(totalMonths);
      if (!months || months < 1) return null;
      const inst = Math.floor(amount / months);
      const lastInstallment = amount - inst * (months - 1);
      return {
        monthlyInstallment: inst,
        totalMonths: months,
        lastInstallment,
      };
    }
    if (repaymentType === "next_salary") {
      return {
        monthlyInstallment: amount,
        totalMonths: 1,
        lastInstallment: amount,
      };
    }
    return null;
  }, [loanAmount, repaymentType, monthlyInstallment, totalMonths]);

  // Form submit
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setErrors({});

    const newErrors = {};
    if (selectedEmployees.length === 0) {
      newErrors.employee = "Please select at least one employee";
    }
    const parsedAmount = Number(loanAmount);
    if (!loanAmount || isNaN(parsedAmount) || parsedAmount < 1) {
      newErrors.amount = "Loan amount must be at least 1";
    }
    if (!repaymentType) {
      newErrors.repaymentType = "Please select a repayment type";
    }
    if (repaymentType === "fixed_amount") {
      const inst = Number(monthlyInstallment);
      if (!inst || inst <= 0) {
        newErrors.monthlyInstallment = "Monthly installment must be a positive number";
      } else if (inst > parsedAmount) {
        newErrors.monthlyInstallment = "Installment cannot exceed loan amount";
      }
    }
    if (repaymentType === "fixed_months") {
      const months = Number(totalMonths);
      if (!Number.isInteger(months) || months < 1) {
        newErrors.totalMonths = "Total months must be a positive integer";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      employees: selectedEmployees.map((e) => e._id),
      loanAmount: parsedAmount,
      repaymentType,
      ...(repaymentType === "fixed_amount" && {
        monthlyInstallment: Number(monthlyInstallment),
      }),
      ...(repaymentType === "fixed_months" && {
        totalMonths: Number(totalMonths),
      }),
      reason: loanReason.trim(),
    };

    createMutation.mutate(payload);
  };

  // Settle
  const handleSettle = (loan) => {
    setSettlingLoan(loan);
    setSettleDialogOpen(true);
  };

  const confirmSettle = () => {
    if (settlingLoan) settleMutation.mutate(settlingLoan._id);
  };

  // ===========================================================================
  // DERIVED — view dialog data
  // ===========================================================================
  const loanDetail = loanDetailsData?.loan || null;

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h1 className={styles.title}>Loans / Advances</h1>
        <Button
          variant="green"
          className="cursor-pointer"
          onClick={() => setCreateDialogOpen(true)}
        >
          <PlusIcon size={16} />
          Apply for Loan
        </Button>
      </div>

      {/* ── Controls ── */}
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

        <Select value={limit.toString()} onValueChange={handleLimitChange}>
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
          onOpenChange={setFilterPopoverOpen}
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
                    Filter loan records.
                  </p>
                </div>

                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Department</Label>
                    <Select
                      value={tempFilterDepartment || "all"}
                      onValueChange={(v) =>
                        setTempFilterDepartment(v === "all" ? "" : v)
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
                      onValueChange={(v) =>
                        setTempFilterPosition(v === "all" ? "" : v)
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
                    <Label>Status</Label>
                    <Select
                      value={tempFilterStatus || "all"}
                      onValueChange={(v) =>
                        setTempFilterStatus(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Approved">Approved</SelectItem>
                          <SelectItem value="Rejected">Rejected</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label>Year</Label>
                    <Select
                      value={tempFilterYear || "all"}
                      onValueChange={(v) =>
                        setTempFilterYear(v === "all" ? "" : v)
                      }
                    >
                      <SelectTrigger className="w-full col-span-2">
                        <SelectValue placeholder="All years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="all">All Years</SelectItem>
                          {YEARS.map((yr) => (
                            <SelectItem key={yr} value={yr}>
                              {yr}
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

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={data?.loans || []}
        onEdit={handleEdit}
        editLabel="View"
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        approveLabel="Approve"
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading loans..."
      />

      {/* ── Pagination ── */}
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

      {/* ============================================================= */}
      {/* CREATE LOAN DIALOG                                             */}
      {/* ============================================================= */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setTimeout(resetCreateForm, 200);
        }}
      >
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle className="flex justify-center text-primary">
              Apply for Loan
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a new loan for selected employees
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            {errors.server && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.server}</p>
              </div>
            )}
            <div className="grid gap-4">
              {/* Employee Multi-select */}
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
                            {employeesList.map((emp) => {
                              const isSelected = selectedEmployees.some(
                                (e) => e._id === emp._id,
                              );
                              return (
                                <CommandItem
                                  key={emp._id}
                                  value={`${emp.fullName} ${emp.employeeID}`}
                                  onSelect={() => toggleEmployee(emp._id)}
                                  disabled={emp.hasActiveLoan && !isSelected}
                                  className="cursor-pointer"
                                >
                                  <CheckIcon
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected
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
                                      {emp.hasActiveLoan && (
                                        <span className="ml-2 text-orange-500">
                                          (Active loan exists)
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </CommandItem>
                              );
                            })}
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

              {/* Loan Amount */}
              <div className="grid gap-3">
                <Label className="text-foreground">Loan Amount (PKR)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  placeholder="Enter loan amount"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                />
                {errors.amount && (
                  <p className="text-sm text-red-500 mt-1">{errors.amount}</p>
                )}
              </div>

              {/* Repayment Type */}
              <div className="grid gap-3">
                <Label className="text-foreground">Repayment Type</Label>
                <Select value={repaymentType} onValueChange={setRepaymentType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select repayment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="fixed_amount">
                        Fixed Amount (Monthly)
                      </SelectItem>
                      <SelectItem value="fixed_months">
                        Fixed Months
                      </SelectItem>
                      <SelectItem value="next_salary">
                        Next Salary (Full Deduction)
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.repaymentType && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.repaymentType}
                  </p>
                )}
              </div>

              {/* Fixed Amount — Monthly Installment */}
              {repaymentType === "fixed_amount" && (
                <div className="grid gap-3">
                  <Label className="text-foreground">
                    Monthly Installment (PKR)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Enter monthly installment"
                    value={monthlyInstallment}
                    onChange={(e) => setMonthlyInstallment(e.target.value)}
                  />
                  {errors.monthlyInstallment && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.monthlyInstallment}
                    </p>
                  )}
                </div>
              )}

              {/* Fixed Months — Number of months */}
              {repaymentType === "fixed_months" && (
                <div className="grid gap-3">
                  <Label className="text-foreground">Number of Months</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    placeholder="Enter number of months"
                    value={totalMonths}
                    onChange={(e) => setTotalMonths(e.target.value)}
                  />
                  {errors.totalMonths && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.totalMonths}
                    </p>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="grid gap-3">
                <Label className="text-foreground">Reason (optional)</Label>
                <Textarea
                  placeholder="Enter reason for the loan..."
                  value={loanReason}
                  onChange={(e) => setLoanReason(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Breakdown Preview */}
              {breakdownPreview && (
                <div className={styles.breakdownPreview}>
                  <div className={styles.breakdownPreviewTitle}>
                    Repayment Preview
                  </div>
                  <div className={styles.breakdownPreviewRow}>
                    <span>Loan Amount</span>
                    <span className={styles.breakdownPreviewValue}>
                      {currency(loanAmount)}
                    </span>
                  </div>
                  <div className={styles.breakdownPreviewRow}>
                    <span>Monthly Installment</span>
                    <span className={styles.breakdownPreviewValue}>
                      {currency(breakdownPreview.monthlyInstallment)}
                    </span>
                  </div>
                  <div className={styles.breakdownPreviewRow}>
                    <span>Total Months</span>
                    <span className={styles.breakdownPreviewValue}>
                      {breakdownPreview.totalMonths}
                    </span>
                  </div>
                  {breakdownPreview.totalMonths > 1 && (
                    <div className={styles.breakdownPreviewRow}>
                      <span>Last Installment</span>
                      <span className={styles.breakdownPreviewValue}>
                        {currency(breakdownPreview.lastInstallment)}
                      </span>
                    </div>
                  )}
                </div>
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
                disabled={createMutation.isPending}
                className="cursor-pointer"
              >
                {createMutation.isPending ? (
                  <>
                    <Spinner />
                    Creating
                  </>
                ) : (
                  "Apply Loan"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================= */}
      {/* VIEW LOAN DIALOG                                               */}
      {/* ============================================================= */}
      <Dialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setTimeout(() => setViewingLoanId(null), 200);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <div>
            <DialogHeader>
              <div className="px-6 pt-6">
                <DialogTitle className="text-primary">Loan Details</DialogTitle>
                <DialogDescription className="sr-only">
                  View details for this loan
                </DialogDescription>
              </div>
            </DialogHeader>

            <ScrollArea className={styles.loanScrollArea}>
              <div className={styles.loanDialogContent}>
                {loanDetail ? (
                  <>
                    {/* ── Employee Info ── */}
                    <div className={styles.sectionTitle}>Employee</div>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoGroup}>
                        <div className={styles.infoLabel}>Name</div>
                        <div className={styles.infoValue}>
                          {loanDetail.employee?.fullName || "-"} (
                          {loanDetail.employee?.employeeID || "-"})
                        </div>
                      </div>
                      <div className={styles.infoGroup}>
                        <div className={styles.infoLabel}>Department</div>
                        <div className={styles.infoValue}>
                          {loanDetail.employee?.position?.department?.name || "-"}
                        </div>
                      </div>
                      <div className={styles.infoGroup}>
                        <div className={styles.infoLabel}>Position</div>
                        <div className={styles.infoValue}>
                          {loanDetail.employee?.position?.name || "-"}
                        </div>
                      </div>
                      <div className={styles.infoGroup}>
                        <div className={styles.infoLabel}>Status</div>
                        <div>
                          <Badge
                            className={STATUS_BADGE_CLASS[loanDetail.status] || "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"}
                          >
                            {loanDetail.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* ── Loan Summary ── */}
                    <div className={styles.sectionTitle}>Loan Summary</div>
                    <div className={styles.loanSummaryGrid}>
                      <div className={styles.loanSummaryStat}>
                        <div className={styles.loanStatValue}>
                          {currency(loanDetail.loanAmount)}
                        </div>
                        <div className={styles.loanStatLabel}>Loan Amount</div>
                      </div>
                      <div className={styles.loanSummaryStat}>
                        <div className={styles.loanStatValue}>
                          {currency(loanDetail.totalPaid)}
                        </div>
                        <div className={styles.loanStatLabel}>Total Paid</div>
                      </div>
                      <div className={styles.loanSummaryStat}>
                        <div className={styles.loanStatValue}>
                          {currency(loanDetail.remainingBalance)}
                        </div>
                        <div className={styles.loanStatLabel}>Remaining</div>
                      </div>
                      {loanDetail.monthlyInstallment > 0 && (
                        <div className={styles.loanSummaryStat}>
                          <div className={styles.loanStatValue}>
                            {currency(loanDetail.monthlyInstallment)}
                          </div>
                          <div className={styles.loanStatLabel}>Installment</div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* ── Details ── */}
                    <div className={styles.sectionTitle}>Details</div>
                    <div className={styles.detailsWrap}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Repayment Type</span>
                        <span className={styles.detailValue}>
                          {REPAYMENT_LABELS[loanDetail.repaymentType] ||
                            loanDetail.repaymentType}
                        </span>
                      </div>
                      {loanDetail.reason && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Reason</span>
                          <span className={styles.detailValue}>
                            {loanDetail.reason}
                          </span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Created</span>
                        <span className={styles.detailValue}>
                          {formatDate(loanDetail.createdAt)}
                        </span>
                      </div>
                      {loanDetail.approvedBy && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Approved By</span>
                          <span className={styles.detailValue}>
                            {loanDetail.approvedBy.name || loanDetail.approvedBy.email}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Repayment Schedule ── */}
                    {loanDetail.repaymentSchedule?.length > 0 && (
                      <>
                        <Separator />
                        <div className={styles.sectionTitle}>
                          Repayment Schedule
                        </div>
                        <div className={styles.scheduleTableWrap}>
                          <table className={styles.scheduleTable}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Month</th>
                                <th>Scheduled</th>
                                <th>Paid</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {loanDetail.repaymentSchedule.map((entry, idx) => (
                                <tr key={idx}>
                                  <td>{idx + 1}</td>
                                  <td>
                                    {MONTH_NAMES[entry.month]} {entry.year}
                                  </td>
                                  <td>{currency(entry.amount)}</td>
                                  <td>
                                    {entry.actualAmount > 0
                                      ? currency(entry.actualAmount)
                                      : "-"}
                                  </td>
                                  <td>
                                    <Badge
                                      className={cn(
                                        "text-xs",
                                        entry.status === "Paid"
                                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                                          : entry.status === "Partial"
                                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                                            : entry.status === "Skipped"
                                              ? "bg-red-100 text-red-700 hover:bg-red-100"
                                              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
                                      )}
                                    >
                                      {entry.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* ── Action Buttons ── */}
                    <div className={styles.loanDialogFooter}>
                      {isAdmin &&
                        loanDetail.status === "Approved" &&
                        loanDetail.remainingBalance > 0 && (
                          <Button
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => handleSettle(loanDetail)}
                            disabled={settleMutation.isPending}
                          >
                            {settleMutation.isPending ? (
                              <>
                                <Spinner />
                                Settling
                              </>
                            ) : (
                              "Early Settlement"
                            )}
                          </Button>
                        )}
                      {isAdmin && loanDetail.status === "Pending" && (
                        <>
                          <Button
                            variant="green"
                            className="cursor-pointer"
                            onClick={() => {
                              approveMutation.mutate(loanDetail._id);
                            }}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <>
                                <Spinner />
                                Approving
                              </>
                            ) : (
                              "Approve"
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={() => {
                              rejectMutation.mutate(loanDetail._id);
                            }}
                            disabled={rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? (
                              <>
                                <Spinner />
                                Rejecting
                              </>
                            ) : (
                              "Reject"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Loan not found.
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================= */}
      {/* DELETE DIALOG                                                  */}
      {/* ============================================================= */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setTimeout(() => setDeletingLoan(null), 200);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              Delete Loan
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the loan of{" "}
              <span className="font-semibold text-primary">
                {currency(deletingLoan?.loanAmount)}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-primary">
                &quot;{deletingLoan?.employee?.fullName}&quot;
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

      {/* ============================================================= */}
      {/* SETTLE DIALOG                                                  */}
      {/* ============================================================= */}
      <AlertDialog
        open={settleDialogOpen}
        onOpenChange={(open) => {
          setSettleDialogOpen(open);
          if (!open) setTimeout(() => setSettlingLoan(null), 200);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">
              Early Settlement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to settle this loan early? The remaining
              balance of{" "}
              <span className="font-semibold text-primary">
                {currency(settlingLoan?.remainingBalance)}
              </span>{" "}
              will be marked as settled and future scheduled installments will be
              skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={settleMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSettle}
              disabled={settleMutation.isPending}
              className="bg-primary text-white hover:bg-primary/80 cursor-pointer"
            >
              {settleMutation.isPending ? (
                <>
                  <Spinner />
                  Settling
                </>
              ) : (
                "Confirm Settlement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Loans;
