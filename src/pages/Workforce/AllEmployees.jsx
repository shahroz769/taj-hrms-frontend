// React
import { useEffect, useState } from "react";

// React Router
import { Link, useNavigate, useSearchParams } from "react-router";

// External Libraries
import { useQuery } from "@tanstack/react-query";
import { CircleXIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react";

// Components
import DataTable from "@/components/DataTable/data-table";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Services
import { fetchEmployees } from "@/services/employeesApi";

// Utils
import { formatDate } from "@/utils/dateUtils";

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

    setSearchParams(params, { replace: true });
  }, [limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // REACT QUERY
  // ===========================================================================

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["employees", { limit, page, search: debouncedSearch }],
    queryFn: () => fetchEmployees({ limit, page, search: debouncedSearch }),
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
      label: "Assigned Shifts",
      render: () => "-",
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
        <Link to="/workforce/employees/add">
          <Button variant="green" className="cursor-pointer">
            <PlusIcon size={16} />
            Add New Employee
          </Button>
        </Link>
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
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.employees || []}
        onEdit={handleEdit}
        isLoading={isLoading}
        isError={isError}
        loadingText="Loading employees..."
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
