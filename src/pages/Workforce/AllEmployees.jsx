// React
import { useEffect, useState } from "react";

// React Router
import { Link, useNavigate, useSearchParams } from "react-router";

// External Libraries
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CalendarIcon from "lucide-react/dist/esm/icons/calendar";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import PencilIcon from "lucide-react/dist/esm/icons/pencil";
import PlusIcon from "lucide-react/dist/esm/icons/plus";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import { toast } from "sonner";
import { format } from "date-fns";

// Components
import DataTable from "@/components/DataTable/data-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployees } from "@/services/employeesApi";
import {
  assignShiftToEmployees,
  fetchShiftsList,
} from "@/services/employeeShiftsApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";

// Utils
import { formatDate, formatTimeToAMPM } from "@/utils/dateUtils";

// Styles
import styles from "./AllEmployees.module.css";

// ============================================================================
// COMPONENT
// ============================================================================

const AllEmployees = () => {
  // ===========================================================================
  // HOOKS
  // ===========================================================================
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

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
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Filter state
  const [filterDepartment, setFilterDepartment] = useState(
    searchParams.get("department") || "",
  );
  const [filterPosition, setFilterPosition] = useState(
    searchParams.get("position") || "",
  );
  const [filterStatus, setFilterStatus] = useState(
    searchParams.get("status") || "",
  );
  const [filterType, setFilterType] = useState(searchParams.get("type") || "");
  const [filterShift, setFilterShift] = useState(
    searchParams.get("shift") || "",
  );

  // UI state
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  // Temporary filter state (for popover)
  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [tempFilterStatus, setTempFilterStatus] = useState("");
  const [tempFilterType, setTempFilterType] = useState("");
  const [tempFilterShift, setTempFilterShift] = useState("");

  // Selection state
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Modal state
  const [assignShiftModalOpen, setAssignShiftModalOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date());

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
  // Reset to page 1 when debounced search changes
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

    if (filterDepartment) params.department = filterDepartment;
    if (filterPosition) params.position = filterPosition;
    if (filterStatus) params.status = filterStatus;
    if (filterType) params.type = filterType;
    if (filterShift) params.shift = filterShift;

    setSearchParams(params, { replace: true });
  }, [
    limit,
    page,
    debouncedSearch,
    filterDepartment,
    filterPosition,
    filterStatus,
    filterType,
    filterShift,
    setSearchParams,
  ]);

  // ---------------------------------------------------------------------------
  // Clear selection when page changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setSelectedEmployeeIds([]);
  }, [page, limit, debouncedSearch]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "employees",
      {
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        type: filterType,
        shift: filterShift,
      },
    ],
    queryFn: () =>
      fetchEmployees({
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        type: filterType,
        shift: filterShift,
      }),
  });

  // Shifts list query (lazy loading)
  const {
    data: shiftsList,
    isLoading: isLoadingShifts,
    refetch: refetchShiftsList,
  } = useQuery({
    queryKey: ["shiftsList"],
    queryFn: fetchShiftsList,
    enabled: false,
  });

  // Departments list query (lazy loading)
  const {
    data: departmentsList,
    isLoading: isLoadingDepartments,
    refetch: fetchDepartments,
  } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: false,
  });

  // Positions filters query (lazy loading)
  const {
    data: positionsFilters,
    isLoading: isLoadingPositionsFilters,
    refetch: fetchPositionsFiltersData,
  } = useQuery({
    queryKey: ["positionsFilters"],
    queryFn: fetchPositionsFilters,
    enabled: false,
  });

  // Extract unique position names
  const uniquePositionNames =
    positionsFilters?.positionsFiltersList
      ?.map((p) => p.name)
      .filter((value, index, self) => self.indexOf(value) === index) || [];

  // ===========================================================================
  // MUTATIONS
  // ===========================================================================

  const assignShiftMutation = useMutation({
    mutationFn: assignShiftToEmployees,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setSelectedEmployeeIds([]);
      setAssignShiftModalOpen(false);
      setSelectedShiftId("");
      setEffectiveDate(new Date());
      toast.success(response.message || "Shift assigned successfully");
    },
    onError: (error) => {
      const errorMessage =
        error.response?.data?.message || "Failed to assign shift";
      toast.error(errorMessage);
    },
  });

  // ===========================================================================
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "employeeID",
      label: "Employee ID",
    },
    {
      key: "fullName",
      label: "Employee Name",
    },
    {
      key: "department",
      label: "Department",
      render: (row) => row.position?.department?.name || "-",
    },
    {
      key: "position",
      label: "Position",
      render: (row) => row.position?.name || "-",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const statusStyles = {
          Active: "bg-green-100 text-green-800",
          Inactive: "bg-gray-100 text-gray-800",
          Resigned: "bg-orange-100 text-orange-800",
          Terminated: "bg-red-100 text-red-800",
        };
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusStyles[row.status] || "bg-gray-100 text-gray-800"
            }`}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      key: "employmentType",
      label: "Type",
      render: (row) => {
        const typeStyles = {
          Permanent: "bg-blue-100 text-blue-800",
          Contract: "bg-purple-100 text-purple-800",
          "Part Time": "bg-teal-100 text-teal-800",
        };
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              typeStyles[row.employmentType] || "bg-gray-100 text-gray-800"
            }`}
          >
            {row.employmentType || "-"}
          </span>
        );
      },
    },
    {
      key: "assignedShifts",
      label: "Assigned Shift",
      render: (row) =>
        row.currentShift ? (
          <div>
            <span className="font-medium">{row.currentShift.name}</span>
            <span className="text-xs text-muted-foreground block">
              {formatTimeToAMPM(row.currentShift.startTime)} -{" "}
              {formatTimeToAMPM(row.currentShift.endTime)}
            </span>
            <span className="text-xs text-muted-foreground block">
              {formatDate(row.currentShift.effectiveDate)}
            </span>
          </div>
        ) : (
          "-"
        ),
    },
    {
      key: "joiningDate",
      label: "Joining Date",
      render: (row) => (row.joiningDate ? formatDate(row.joiningDate) : "-"),
    },
    {
      key: "actions",
      label: "Actions",
      align: "center",
      renderEdit: () => <PencilIcon size={18} />,
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handleEdit = (row) => {
    navigate(`/workforce/employees/${row._id}/edit`);
  };

  const handleSelectionChange = (newSelection) => {
    setSelectedEmployeeIds(newSelection);
  };

  const handleAssignShiftOpenChange = async (open) => {
    setAssignShiftModalOpen(open);
    if (open) {
      await refetchShiftsList();
    } else {
      setSelectedShiftId("");
      setEffectiveDate(new Date());
    }
  };

  const handleAssignConfirm = () => {
    if (!selectedShiftId) {
      toast.error("Please select a shift");
      return;
    }

    if (!effectiveDate) {
      toast.error("Please select an effective date");
      return;
    }

    assignShiftMutation.mutate({
      employeeIds: selectedEmployeeIds,
      shiftId: selectedShiftId,
      effectiveDate: format(effectiveDate, "yyyy-MM-dd"),
    });
  };

  // ---------------------------------------------------------------------------
  // Filter Handlers
  // ---------------------------------------------------------------------------
  const handleFilterClick = async (e) => {
    e.preventDefault();
    setIsFiltersLoading(true);
    try {
      await Promise.all([
        fetchDepartments(),
        fetchPositionsFiltersData(),
        refetchShiftsList(),
      ]);
      setTempFilterDepartment(filterDepartment);
      setTempFilterPosition(filterPosition);
      setTempFilterStatus(filterStatus);
      setTempFilterType(filterType);
      setTempFilterShift(filterShift);
      setFilterPopoverOpen(true);
    } catch (error) {
      toast.error("Failed to load filter data");
    } finally {
      setIsFiltersLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setFilterDepartment(tempFilterDepartment);
    setFilterPosition(tempFilterPosition);
    setFilterStatus(tempFilterStatus);
    setFilterType(tempFilterType);
    setFilterShift(tempFilterShift);
    setPage(1); // Reset to page 1
    setFilterPopoverOpen(false);
  };

  const handleResetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setTempFilterStatus("");
    setTempFilterType("");
    setTempFilterShift("");

    setFilterDepartment("");
    setFilterPosition("");
    setFilterStatus("");
    setFilterType("");
    setFilterShift("");
    setPage(1);
    setFilterPopoverOpen(false);
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

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>All Employees</h1>
        <div className="flex items-center gap-3">
          <Dialog
            open={assignShiftModalOpen}
            onOpenChange={handleAssignShiftOpenChange}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="cursor-pointer relative"
                disabled={selectedEmployeeIds.length === 0}
              >
                <CalendarIcon size={16} />
                Assign Shift
                {selectedEmployeeIds.length > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-5 px-1.5 bg-[#02542D] text-white text-[11px] font-semibold">
                    {selectedEmployeeIds.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Assign Shift</DialogTitle>
                <DialogDescription>
                  Assign a shift to {selectedEmployeeIds.length} selected
                  employee(s).
                </DialogDescription>
              </DialogHeader>
              {isLoadingShifts ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : (
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shift">Shift</Label>
                    <Select
                      value={selectedShiftId}
                      onValueChange={setSelectedShiftId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {shiftsList?.map((shift) => (
                            <SelectItem key={shift._id} value={shift._id}>
                              {shift.name} ({formatTimeToAMPM(shift.startTime)} -{" "}
                              {formatTimeToAMPM(shift.endTime)})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Effective From</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={`w-full justify-start text-left font-normal ${!effectiveDate && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {effectiveDate ? (
                            format(effectiveDate, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={effectiveDate}
                          onSelect={setEffectiveDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAssignShiftModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="green"
                  onClick={handleAssignConfirm}
                  disabled={assignShiftMutation.isPending || isLoadingShifts}
                >
                  {assignShiftMutation.isPending ? (
                    <>
                      <Spinner /> Assigning...
                    </>
                  ) : (
                    "Assign"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Link to="/workforce/employees/add">
            <Button variant="green" className="cursor-pointer">
              <PlusIcon size={16} />
              Add New Employee
            </Button>
          </Link>
        </div>
      </div>

      <div className={styles.controls}>
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search Employees..."
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
              <SelectItem value="0">All items</SelectItem>
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
              disabled={isFiltersLoading}
              onClick={handleFilterClick}
            >
              {isFiltersLoading ? <Spinner /> : <SlidersHorizontalIcon />}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="leading-none font-medium">Filters</h4>
                <p className="text-muted-foreground text-sm">
                  Apply the filters for the employees.
                </p>
              </div>
              <div className="grid gap-2">
                {/* Department */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={tempFilterDepartment}
                    onValueChange={setTempFilterDepartment}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value=" ">All Departments</SelectItem>
                        {departmentsList?.map((dept) => (
                          <SelectItem key={dept._id} value={dept._id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Position */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="position">Position</Label>
                  <Select
                    value={tempFilterPosition}
                    onValueChange={setTempFilterPosition}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value=" ">All Positions</SelectItem>
                        {uniquePositionNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={tempFilterStatus}
                    onValueChange={setTempFilterStatus}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value=" ">All Statuses</SelectItem>
                        {["Active", "Inactive", "Resigned", "Terminated"].map(
                          (status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Type */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={tempFilterType}
                    onValueChange={setTempFilterType}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value=" ">All Types</SelectItem>
                        {["Permanent", "Contract", "Part Time"].map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Shift */}
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="shift">Shift</Label>
                  <Select
                    value={tempFilterShift}
                    onValueChange={setTempFilterShift}
                  >
                    <SelectTrigger className="w-full col-span-2">
                      <SelectValue placeholder="Select shift" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value=" ">All Shifts</SelectItem>
                        {shiftsList?.map((shift) => (
                          <SelectItem key={shift._id} value={shift._id}>
                            {shift.name}
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
                  aria-label="Apply"
                  className="cursor-pointer flex-1"
                  onClick={handleApplyFilters}
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  aria-label="Reset"
                  className="cursor-pointer flex-1"
                  onClick={handleResetFilters}
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
        data={data?.employees || []}
        onEdit={handleEdit}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading employees..."
        selectable={true}
        selectedIds={selectedEmployeeIds}
        onSelectionChange={handleSelectionChange}
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
                </PaginationItem>,
              );

              // Show ellipsis if needed
              if (currentPage > 3) {
                pages.push(
                  <PaginationItem key="ellipsis-start">
                    <PaginationEllipsis />
                  </PaginationItem>,
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
                  </PaginationItem>,
                );
              }

              // Show ellipsis if needed
              if (currentPage < totalPages - 2) {
                pages.push(
                  <PaginationItem key="ellipsis-end">
                    <PaginationEllipsis />
                  </PaginationItem>,
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
    </div>
  );
};

export default AllEmployees;
