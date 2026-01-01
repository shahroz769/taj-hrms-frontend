// React
import React, { useEffect, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleXIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TrashIcon,
  XCircle,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services
import {
  createShift,
  deleteShift,
  fetchShifts,
  fetchShiftsFilters,
  updateShift,
} from "@/services/shiftsApi";
import {
  createPosition,
  deletePosition,
  fetchPositions,
  fetchPositionsFilters,
  updatePosition,
} from "@/services/positionsApi";

// Services
import { fetchDepartmentsList } from "@/services/departmentsApi";

// Utils
import {
  formatDate,
  formatTimeToAMPM,
  calculateShiftHours,
  formatWorkingDaysInitials,
} from "@/utils/dateUtils";

// Styles
import styles from "./ShiftsSetups.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const ShiftsSetups = () => {
  // ===========================================================================
  // URL SEARCH PARAMS
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Initial Values from URL
  // ---------------------------------------------------------------------------
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
  const [unlimitedChecked, setUnlimitedChecked] = useState(false);
  const [noneChecked, setNoneChecked] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editingPosition, setEditingPosition] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPosition, setDeletingPosition] = useState(null);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFilterPosition, setSelectedFilterPosition] = useState("");
  const [selectedFilterReportsTo, setSelectedFilterReportsTo] = useState("");
  const [selectedFilterDepartment, setSelectedFilterDepartment] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Debounce search input
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // ---------------------------------------------------------------------------
  // Reset to page 1 when debounced search changes (after user stops typing)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchValue !== "") {
      setPage(1);
    }
  }, [debouncedSearch, searchValue]);

  // ---------------------------------------------------------------------------
  // Update URL when limit, page, or debouncedSearch changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = {};

    if (limit !== 10) {
      params.limit = limit.toString();
    }

    if (page !== 1) {
      params.page = page.toString();
    }

    if (debouncedSearch) {
      params.search = debouncedSearch;
    }

    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================
  const queryClient = useQueryClient();

  // ---------------------------------------------------------------------------
  // Fetch Shifts Query
  // ---------------------------------------------------------------------------
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["shifts", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchShifts({ limit, page, search: debouncedSearch }),
  });

  console.log(data);

  const {
    data: filters,
    isLoading: isCheckingFilters,
    refetch: fetchFilters,
  } = useQuery({
    queryKey: ["positionsFilters"],
    queryFn: () => fetchPositionsFilters(),
    enabled: false,
  });

  // ---------------------------------------------------------------------------
  // Extract Unique Filter Values
  // ---------------------------------------------------------------------------
  const filtersList = filters?.positionsFiltersList ?? [];

  const uniquePositions = React.useMemo(
    () => [...new Set(filtersList.map((item) => item.name))].filter(Boolean),
    [filtersList]
  );

  const uniqueReportsTo = React.useMemo(
    () =>
      [...new Set(filtersList.map((item) => item.reportsTo))].filter(Boolean),
    [filtersList]
  );

  const uniqueDepartments = React.useMemo(
    () =>
      [...new Set(filtersList.map((item) => item.department?.name))].filter(
        Boolean
      ),
    [filtersList]
  );

  // ---------------------------------------------------------------------------
  // Fetch Departments List Query (lazy loading)
  // ---------------------------------------------------------------------------
  const {
    data: departmentsList,
    isLoading: isCheckingDepartments,
    refetch: fetchDepartments,
  } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: false, // Don't fetch on mount, only when manually triggered
  });

  // ---------------------------------------------------------------------------
  // Create Position Mutation
  // ---------------------------------------------------------------------------
  const mutation = useMutation({
    mutationFn: createPosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setUnlimitedChecked(false);
      setNoneChecked(false);
      setSelectedDepartment("");
      setDialogOpen(false);
      setErrors({});
      setEditingPosition(null);
      toast.success("Position created successfully");
    },
    onError: (error) => {
      console.error("Error creating position:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create position";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Update Position Mutation
  // ---------------------------------------------------------------------------
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePosition(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setUnlimitedChecked(false);
      setNoneChecked(false);
      setSelectedDepartment("");
      setDialogOpen(false);
      setErrors({});
      setEditingPosition(null);
      toast.success("Position updated successfully");
    },
    onError: (error) => {
      console.error("Error updating position:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to update position";
      setErrors({ server: errorMessage });
      toast.error(errorMessage);
    },
  });

  // ---------------------------------------------------------------------------
  // Delete Position Mutation
  // ---------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deletePosition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDeleteDialogOpen(false);
      setDeletingPosition(null);
      toast.success("Position deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting position:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete position";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "name",
      label: "Shift Name",
    },
    {
      key: "startTime",
      label: "Start Time",
      render: (row) => formatTimeToAMPM(row.startTime),
    },
    {
      key: "endTime",
      label: "End Time",
      render: (row) => formatTimeToAMPM(row.endTime),
    },
    {
      key: "workingDays",
      label: "Working Days",
      render: (row) => formatWorkingDaysInitials(row.workingDays),
    },
    {
      key: "intervals",
      label: "Intervals",
      render: (row) => row.intervals?.length || 0,
    },
    {
      key: "shiftHours",
      label: "Shift Hrs",
      render: (row) => calculateShiftHours(row.startTime, row.endTime),
    },
    {
      key: "createdBy",
      label: "Requested By",
      render: (row) => row.createdBy || "-",
    },
    {
      key: "createdAt",
      label: "Creation Date",
      render: (row) => formatDate(row.createdAt),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const status = row.status;
        if (status === "Approved") {
          return (
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
              Approved
            </Badge>
          );
        }
        if (status === "Rejected") {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              Rejected
            </Badge>
          );
        }
        // Default: Pending
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            Pending
          </Badge>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      renderEdit: () => <PencilIcon size={18} />,
      renderDelete: () => <TrashIcon size={18} />,
      renderApprove: (row) =>
        row.status === "Pending" ? <CheckCircle2 size={18} /> : null,
      renderReject: (row) =>
        row.status === "Pending" ? <XCircle size={18} /> : null,
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Edit & Delete Handlers
  // ---------------------------------------------------------------------------
  const handleEdit = async (row) => {
    // Fetch departments first
    const result = await fetchDepartments();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message || "Failed to fetch departments";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add department first");
      return;
    }

    // Set all the editing states
    setEditingPosition(row);
    setSelectedDepartment(row.department?._id || "");
    setUnlimitedChecked(row.employeeLimit === "Unlimited");
    setNoneChecked(row.reportsTo === "None" || !row.reportsTo);
    setDialogOpen(true);
  };

  const handleDelete = (row) => {
    setDeletingPosition(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingPosition) {
      deleteMutation.mutate(deletingPosition._id);
    }
  };

  // ---------------------------------------------------------------------------
  // Approve & Reject Handlers
  // ---------------------------------------------------------------------------
  const handleApprove = (row) => {
    console.log("Approve shift ID:", row._id);
  };

  const handleReject = (row) => {
    console.log("Reject shift ID:", row._id);
  };

  // ---------------------------------------------------------------------------
  // Add Position Handler
  // ---------------------------------------------------------------------------
  const handleAddPositionClick = async () => {
    const result = await fetchDepartments();

    if (result.isError) {
      const errorMessage =
        result.error?.response?.data?.message || "Failed to fetch departments";
      toast.error(errorMessage);
      return;
    }

    if (!result.data || result.data.length === 0) {
      toast.error("Add department first");
      return;
    }

    // If departments exist, open the dialog
    setDialogOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Search Handlers
  // ---------------------------------------------------------------------------
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Pagination Handlers
  // ---------------------------------------------------------------------------
  const handleLimitChange = (value) => {
    setLimit(Number(value));
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (data?.pagination && page < data.pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // ---------------------------------------------------------------------------
  // Form Submit Handler
  // ---------------------------------------------------------------------------
  const handleCreatePosition = (e) => {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.target);
    const payload = {
      name: formData.get("position-name"),
      department: selectedDepartment,
      reportsTo: noneChecked ? "None" : formData.get("reports-to"),
      employeeLimit: unlimitedChecked
        ? "Unlimited"
        : formData.get("employee-limit"),
    };

    // Validate
    const newErrors = {};

    if (!payload.name?.trim()) {
      newErrors.name = "Position name is required";
    }

    if (!payload.department) {
      newErrors.department = "Department is required";
    }

    if (!noneChecked && !payload.reportsTo?.trim()) {
      newErrors.reportsTo = "Reports to is required";
    }

    if (!unlimitedChecked && !payload.employeeLimit?.trim()) {
      newErrors.employeeLimit = "Employee limit is required";
    }

    // Validate position count is a positive integer when not unlimited
    if (!unlimitedChecked && payload.employeeLimit?.trim()) {
      const employeeLimitValue = payload.employeeLimit.trim();
      const isValidNumber = /^\d+$/.test(employeeLimitValue); // Only positive integers
      const numericValue = Number(employeeLimitValue);

      if (
        !isValidNumber ||
        numericValue <= 0 ||
        !Number.isInteger(numericValue)
      ) {
        newErrors.employeeLimit = "Employee limit must be a proper number";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingPosition) {
      // Update existing position
      updateMutation.mutate(
        { id: editingPosition._id, payload },
        {
          onSuccess: () => {
            e.target.reset();
          },
        }
      );
    } else {
      // Create new position
      mutation.mutate(payload, {
        onSuccess: () => {
          e.target.reset();
        },
      });
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Shifts Setup</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setErrors({});
              setTimeout(() => {
                setEditingPosition(null);
                setUnlimitedChecked(false);
                setSelectedDepartment("");
                setNoneChecked(false);
              }, 200);
            }
          }}
        >
          <Button
            variant="green"
            className="cursor-pointer"
            onClick={handleAddPositionClick}
            disabled={isCheckingDepartments}
          >
            {isCheckingDepartments ? <Spinner /> : <PlusIcon size={16} />}
            Add Shift
          </Button>
          <DialogContent className="sm:max-w-125">
            <DialogHeader>
              <DialogTitle className="flex justify-center text-[#02542D]">
                {editingPosition ? "Edit Position" : "Add Position"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {editingPosition
                  ? "Edit the position information below"
                  : "Create a new position by entering the name and employee limits"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePosition}>
              {errors.server && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.server}</p>
                </div>
              )}
              <div className="grid gap-4">
                <div className="grid gap-3">
                  <Label htmlFor="position-name" className="text-[#344054]">
                    Position Name
                  </Label>
                  <Input
                    id="position-name"
                    name="position-name"
                    placeholder="Enter position name"
                    defaultValue={editingPosition?.name || ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>
                {/* Select Department */}
                <div className="grid gap-3">
                  <Label htmlFor="department" className="text-[#344054]">
                    Department
                  </Label>
                  <Select
                    value={selectedDepartment}
                    onValueChange={(value) => {
                      setSelectedDepartment(value);
                      if (errors.department) {
                        setErrors({ ...errors, department: undefined });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {departmentsList?.map((dept) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.department && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.department}
                    </p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="reports-to" className="text-[#344054]">
                    Reports To
                  </Label>
                  <InputGroup className={styles.searchInput}>
                    <InputGroupInput
                      id="reports-to"
                      name="reports-to"
                      placeholder="Enter employee ID"
                      disabled={noneChecked}
                      defaultValue={
                        editingPosition?.reportsTo !== "None"
                          ? editingPosition?.reportsTo || ""
                          : ""
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <Checkbox
                        checked={noneChecked}
                        onCheckedChange={(checked) => {
                          setNoneChecked(checked);
                          if (checked && errors.reportsTo) {
                            setErrors({ ...errors, reportsTo: undefined });
                          }
                        }}
                        className="data-[state=checked]:bg-[#02542D] data-[state=checked]:border-[#02542D]"
                      />
                      <p>None</p>
                    </InputGroupAddon>
                  </InputGroup>
                  {errors.reportsTo && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.reportsTo}
                    </p>
                  )}
                </div>
                <div className="grid gap-3">
                  <Label htmlFor="employee-limit" className="text-[#344054]">
                    Employee Limit
                  </Label>
                  <InputGroup className={styles.searchInput}>
                    <InputGroupInput
                      id="employee-limit"
                      name="employee-limit"
                      placeholder="Enter employee limit"
                      disabled={unlimitedChecked}
                      defaultValue={
                        editingPosition?.employeeLimit !== "Unlimited"
                          ? editingPosition?.employeeLimit || ""
                          : ""
                      }
                    />
                    <InputGroupAddon align="inline-end">
                      <Checkbox
                        checked={unlimitedChecked}
                        onCheckedChange={(checked) => {
                          setUnlimitedChecked(checked);
                          if (checked && errors.employeeLimit) {
                            setErrors({ ...errors, employeeLimit: undefined });
                          }
                        }}
                        className="data-[state=checked]:bg-[#02542D] data-[state=checked]:border-[#02542D]"
                      />
                      <p>Unlimited</p>
                    </InputGroupAddon>
                  </InputGroup>
                  {errors.employeeLimit && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.employeeLimit}
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
                  disabled={mutation.isPending || updateMutation.isPending}
                  className="cursor-pointer"
                >
                  {mutation.isPending || updateMutation.isPending ? (
                    <>
                      <Spinner />
                      {editingPosition ? "Updating" : "Creating"}
                    </>
                  ) : editingPosition ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search Shifts..."
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

        {/* Page Limit */}
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

        {/* Filters */}
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Filters"
              className="cursor-pointer"
              disabled={isCheckingFilters}
              onClick={async (e) => {
                e.preventDefault();
                const result = await fetchFilters();
                if (result.data) {
                  setFilterPopoverOpen(true);
                }
              }}
            >
              {isCheckingFilters ? <Spinner /> : <SlidersHorizontalIcon />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">Filters</h4>
                <p className="text-muted-foreground text-sm">
                  Apply the filters for the positions.
                </p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="reportsTo">Reports To</Label>
                  <Select
                    value={selectedFilterReportsTo}
                    onValueChange={(value) => {
                      setSelectedFilterReportsTo(value);
                    }}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select reports to" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {uniqueReportsTo.map((reportsTo) => (
                          <SelectItem key={reportsTo} value={reportsTo}>
                            {reportsTo}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={selectedFilterDepartment}
                    onValueChange={(value) => {
                      setSelectedFilterDepartment(value);
                    }}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {uniqueDepartments.map((deptName) => (
                          <SelectItem key={deptName} value={deptName}>
                            {deptName}
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
                  aria-label="Submit"
                  className="cursor-pointer flex-1"
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  aria-label="Submit"
                  className="cursor-pointer flex-1"
                >
                  Reset
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        data={data?.shifts || []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={isLoading}
        isError={isError}
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

            {/* Render page numbers */}
            {(() => {
              const { currentPage, totalPages } = data.pagination;
              const pages = [];

              // Always show first page
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

              // Show ellipsis if needed
              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Show pages around current page
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

              // Show ellipsis if needed
              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              // Always show last page if there's more than one page
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

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setDeletingPosition(null);
            }, 200);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#02542D]">
              Delete Position
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the position{" "}
              <span className="font-semibold text-[#02542D]">
                "{deletingPosition?.name}"
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

export default ShiftsSetups;
