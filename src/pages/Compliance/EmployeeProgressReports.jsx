// React
import { useEffect, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useQuery } from "@tanstack/react-query";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import SearchIcon from "lucide-react/dist/esm/icons/search";
import SlidersHorizontalIcon from "lucide-react/dist/esm/icons/sliders-horizontal";
import StarIcon from "lucide-react/dist/esm/icons/star";
import { toast } from "sonner";

// Components
import DataTable from "@/components/DataTable/data-table";
import { Button } from "@/components/ui/button";
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
import { fetchEmployeeProgressReports } from "@/services/workProgressReportsApi";
import { fetchDepartmentsList } from "@/services/departmentsApi";
import { fetchPositionsFilters } from "@/services/positionsApi";

// Styles
import styles from "./EmployeeProgressReports.module.css";

// ============================================================================
// HELPERS
// ============================================================================

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2023 }, (_, i) => 2024 + i);

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

const QUARTERS = [
  { value: "1", label: "Q1 (Jan - Mar)" },
  { value: "2", label: "Q2 (Apr - Jun)" },
  { value: "3", label: "Q3 (Jul - Sep)" },
  { value: "4", label: "Q4 (Oct - Dec)" },
];

// ============================================================================
// STAR RATING DISPLAY COMPONENT
// ============================================================================

const StarRatingDisplay = ({ value, size = 16 }) => {
  const displayValue = value || 0;

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((starIndex) => {
        const fillPercent = Math.min(
          100,
          Math.max(0, (displayValue - starIndex) * 100),
        );
        return (
          <div
            key={starIndex}
            className="relative"
            style={{ width: size, height: size }}
          >
            <StarIcon
              size={size}
              className="absolute text-gray-200"
              fill="currentColor"
            />
            <div
              className="absolute overflow-hidden"
              style={{ width: `${fillPercent}%`, height: size }}
            >
              <StarIcon
                size={size}
                className="text-yellow-400"
                fill="currentColor"
              />
            </div>
          </div>
        );
      })}
      <span className="ml-1.5 text-sm font-medium text-gray-600">
        {displayValue.toFixed(1)}
      </span>
    </div>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

const EmployeeProgressReports = () => {
  // ===========================================================================
  // HOOKS
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
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);

  // Time period state
  const [periodType, setPeriodType] = useState(
    searchParams.get("periodType") || "yearly",
  );
  const [year, setYear] = useState(
    searchParams.get("year") || CURRENT_YEAR.toString(),
  );
  const [quarter, setQuarter] = useState(searchParams.get("quarter") || "1");
  const [month, setMonth] = useState(searchParams.get("month") || "1");

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

  // UI state
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isFiltersLoading, setIsFiltersLoading] = useState(false);

  // Temporary filter state (for popover)
  const [tempFilterDepartment, setTempFilterDepartment] = useState("");
  const [tempFilterPosition, setTempFilterPosition] = useState("");
  const [tempFilterStatus, setTempFilterStatus] = useState("");
  const [tempFilterType, setTempFilterType] = useState("");

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
  // Update URL when any filter changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const params = {};

    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;

    // Time period params
    if (periodType !== "yearly") params.periodType = periodType;
    if (year !== CURRENT_YEAR.toString()) params.year = year;
    if (periodType === "quarterly" && quarter !== "1") params.quarter = quarter;
    if (periodType === "monthly" && month !== "1") params.month = month;

    // Employee filters
    if (filterDepartment) params.department = filterDepartment;
    if (filterPosition) params.position = filterPosition;
    if (filterStatus) params.status = filterStatus;
    if (filterType) params.type = filterType;

    setSearchParams(params, { replace: true });
  }, [
    limit,
    page,
    debouncedSearch,
    periodType,
    year,
    quarter,
    month,
    filterDepartment,
    filterPosition,
    filterStatus,
    filterType,
    setSearchParams,
  ]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: [
      "employee-progress-reports",
      {
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        type: filterType,
        periodType,
        year,
        quarter: periodType === "quarterly" ? quarter : undefined,
        month: periodType === "monthly" ? month : undefined,
      },
    ],
    queryFn: () =>
      fetchEmployeeProgressReports({
        limit,
        page,
        search: debouncedSearch,
        department: filterDepartment,
        position: filterPosition,
        status: filterStatus,
        type: filterType,
        periodType,
        year: parseInt(year),
        quarter: periodType === "quarterly" ? parseInt(quarter) : undefined,
        month: periodType === "monthly" ? parseInt(month) : undefined,
      }),
  });

  // Departments list query (lazy loading)
  const { data: departmentsList, refetch: fetchDepartments } = useQuery({
    queryKey: ["departmentsList"],
    queryFn: fetchDepartmentsList,
    enabled: false,
  });

  // Positions filters query (lazy loading)
  const { data: positionsFilters, refetch: fetchPositionsFiltersData } =
    useQuery({
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
  // TABLE CONFIGURATION
  // ===========================================================================
  const columns = [
    {
      key: "fullName",
      label: "Employee Name",
    },
    {
      key: "employeeID",
      label: "Employee ID",
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
      key: "tasksCompleted",
      label: "Tasks Completed",
      fontWeight: "medium",
      render: (row) => (
        <span className="font-semibold text-[#02542D]">
          {row.tasksCompleted}
        </span>
      ),
    },
    {
      key: "averageRating",
      label: "Avg. Rating",
      render: (row) =>
        row.tasksCompleted > 0 ? (
          <StarRatingDisplay value={row.averageRating} size={14} />
        ) : (
          <span className="text-sm text-gray-400">N/A</span>
        ),
    },
  ];

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // Period Type change handler
  // ---------------------------------------------------------------------------
  const handlePeriodTypeChange = (value) => {
    setPeriodType(value);
    setPage(1);
  };

  const handleYearChange = (value) => {
    setYear(value);
    setPage(1);
  };

  const handleQuarterChange = (value) => {
    setQuarter(value);
    setPage(1);
  };

  const handleMonthChange = (value) => {
    setMonth(value);
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // Filter Handlers
  // ---------------------------------------------------------------------------
  const handleFilterClick = async (e) => {
    e.preventDefault();
    setIsFiltersLoading(true);
    try {
      await Promise.all([fetchDepartments(), fetchPositionsFiltersData()]);
      setTempFilterDepartment(filterDepartment);
      setTempFilterPosition(filterPosition);
      setTempFilterStatus(filterStatus);
      setTempFilterType(filterType);
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
    setPage(1);
    setFilterPopoverOpen(false);
  };

  const handleResetFilters = () => {
    setTempFilterDepartment("");
    setTempFilterPosition("");
    setTempFilterStatus("");
    setTempFilterType("");

    setFilterDepartment("");
    setFilterPosition("");
    setFilterStatus("");
    setFilterType("");
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
        <h1 className={styles.title}>Employee Progress Reports</h1>
        <div className={styles.periodFilters}>
          {/* Period Type */}
          <Select value={periodType} onValueChange={handlePeriodTypeChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Year */}
          <Select value={year} onValueChange={handleYearChange}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Quarter (conditional) */}
          {periodType === "quarterly" && (
            <Select value={quarter} onValueChange={handleQuarterChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Month (conditional) */}
          {periodType === "monthly" && (
            <Select value={month} onValueChange={handleMonthChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
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
                  Filter the employee list.
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
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading employee progress..."
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

export default EmployeeProgressReports;
