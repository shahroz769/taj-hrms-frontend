// React
import { useCallback, useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import SearchIcon from "lucide-react/dist/esm/icons/search";

// Components
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

// Data
import { getAttendanceData, getMonthSummary } from "./attendanceDummyData";

// Styles
import styles from "./AttendanceRecords.module.css";

// =============================================================================
// HELPERS
// =============================================================================

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Get array of day numbers for a month (1-indexed) */
const getDaysInMonth = (year, month) => {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => i + 1);
};

/** Check if a date is today */
const isToday = (year, month, day) => {
  const today = new Date();
  return (
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day
  );
};

/** Get day-of-week for a date (0=Sun … 6=Sat) */
const getDayOfWeek = (year, month, day) => {
  return new Date(year, month, day).getDay();
};

// =============================================================================
// COMPONENT
// =============================================================================

const AttendanceRecords = () => {
  // ===========================================================================
  // URL STATE
  // ===========================================================================
  const [searchParams, setSearchParams] = useSearchParams();

  // ---------------------------------------------------------------------------
  // Initial Values from URL
  // ---------------------------------------------------------------------------
  const getInitialMonth = () => {
    const urlMonth = searchParams.get("month");
    return urlMonth !== null ? Number(urlMonth) : new Date().getMonth();
  };

  const getInitialYear = () => {
    const urlYear = searchParams.get("year");
    return urlYear !== null ? Number(urlYear) : new Date().getFullYear();
  };

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
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth);
  const [selectedYear, setSelectedYear] = useState(getInitialYear);
  const [searchValue, setSearchValue] = useState(getInitialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(getInitialSearch);
  const [limit, setLimit] = useState(getInitialLimit);
  const [page, setPage] = useState(getInitialPage);
  const [isLoading, setIsLoading] = useState(false);

  // ===========================================================================
  // DERIVED DATA
  // ===========================================================================
  const days = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  const attendanceResult = useMemo(() => {
    return getAttendanceData({
      year: selectedYear,
      month: selectedMonth,
      search: debouncedSearch,
      page,
      limit,
    });
  }, [selectedYear, selectedMonth, debouncedSearch, page, limit]);

  const { data: attendanceData, pagination } = attendanceResult;

  // ===========================================================================
  // EFFECTS
  // ===========================================================================

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Simulate loading on month/year change
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [selectedMonth, selectedYear]);

  // Sync URL params
  useEffect(() => {
    const params = {};
    if (selectedMonth !== new Date().getMonth())
      params.month = selectedMonth.toString();
    if (selectedYear !== new Date().getFullYear())
      params.year = selectedYear.toString();
    if (limit !== 10) params.limit = limit.toString();
    if (page !== 1) params.page = page.toString();
    if (debouncedSearch) params.search = debouncedSearch;
    setSearchParams(params, { replace: true });
  }, [selectedMonth, selectedYear, limit, page, debouncedSearch, setSearchParams]);

  // ===========================================================================
  // EVENT HANDLERS
  // ===========================================================================

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      if (prev === 0) {
        setSelectedYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
    setPage(1);
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonth((prev) => {
      if (prev === 11) {
        setSelectedYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
    setPage(1);
  }, []);

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setDebouncedSearch("");
    setPage(1);
  };

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
    if (pagination && page < pagination.totalPages) setPage(page + 1);
  };

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const renderBadge = useCallback((status) => {
    if (status === null) {
      return <span className={styles.badgeFuture}>—</span>;
    }
    const classMap = {
      P: styles.badgeP,
      A: styles.badgeA,
      L: styles.badgeL,
      Off: styles.badgeOff,
    };
    return <span className={classMap[status] || styles.badge}>{status}</span>;
  }, []);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Attendance Records</h1>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDotP} />
            Present
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotA} />
            Absent
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotL} />
            Leave
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotOff} />
            Off Day
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className={styles.controls}>
        {/* Search */}
        <InputGroup className={styles.tableSearchInput}>
          <InputGroupInput
            placeholder="Search by name or ID..."
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
            {debouncedSearch ? <CircleXIcon /> : null}
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
              <SelectItem value="0">All items</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Month Navigation */}
        <div className={styles.monthNav}>
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer h-9 w-9"
            onClick={handlePrevMonth}
          >
            <ChevronLeftIcon size={18} />
          </Button>
          <span className={styles.monthLabel}>
            {MONTH_NAMES[selectedMonth]} {selectedYear}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="cursor-pointer h-9 w-9"
            onClick={handleNextMonth}
          >
            <ChevronRightIcon size={18} />
          </Button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className={styles.tableContainer}>
        <div className={styles.tableScrollArea}>
          <table className={styles.table}>
            {/* Head */}
            <thead className={styles.tableHead}>
              <tr className={styles.tableHeadRow}>
                <th className={styles.stickyHeader}>Employee</th>
                {days.map((day) => {
                  const dow = getDayOfWeek(selectedYear, selectedMonth, day);
                  const isFriday = dow === 5;
                  const todayFlag = isToday(selectedYear, selectedMonth, day);
                  const headerClass = todayFlag
                    ? styles.dateHeaderToday
                    : isFriday
                      ? styles.dateHeaderOff
                      : styles.dateHeader;
                  return (
                    <th key={day} className={headerClass}>
                      <div>{day}</div>
                      <div style={{ fontSize: "10px", fontWeight: 400 }}>
                        {DAY_ABBR[dow]}
                      </div>
                    </th>
                  );
                })}
                {/* Summary columns */}
                <th className={styles.summaryHeader}>P</th>
                <th className={styles.summaryHeader}>A</th>
                <th className={styles.summaryHeader}>L</th>
                <th className={styles.summaryHeader}>Off</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className={styles.tableBody}>
              {isLoading ? (
                <tr>
                  <td colSpan={days.length + 5}>
                    <div className={styles.stateContainer}>
                      <Spinner className={styles.loader} />
                      <p className={styles.stateText}>
                        Loading attendance data...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : attendanceData.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 5}>
                    <div className={styles.stateContainer}>
                      <p className={styles.stateText}>
                        No attendance records found.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                attendanceData.map((row) => {
                  const summary = getMonthSummary(row.records);
                  return (
                    <tr key={row.employee.id}>
                      {/* Sticky employee column */}
                      <td className={styles.stickyCell}>
                        <div className={styles.employeeName}>
                          {row.employee.name}
                        </div>
                        <div className={styles.employeeId}>
                          {row.employee.id}
                        </div>
                      </td>

                      {/* Day cells */}
                      {days.map((day) => {
                        const status = row.records[day];
                        const isFriday =
                          getDayOfWeek(selectedYear, selectedMonth, day) === 5;
                        return (
                          <td
                            key={day}
                            className={
                              isFriday
                                ? styles.attendanceCellOff
                                : styles.attendanceCell
                            }
                          >
                            {renderBadge(status)}
                          </td>
                        );
                      })}

                      {/* Summary cells */}
                      <td
                        className={`${styles.summaryCell} ${styles.summaryP}`}
                      >
                        {summary.P}
                      </td>
                      <td
                        className={`${styles.summaryCell} ${styles.summaryA}`}
                      >
                        {summary.A}
                      </td>
                      <td
                        className={`${styles.summaryCell} ${styles.summaryL}`}
                      >
                        {summary.L}
                      </td>
                      <td
                        className={`${styles.summaryCell} ${styles.summaryOff}`}
                      >
                        {summary.Off}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
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
              const { currentPage, totalPages } = pagination;
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
                  page === pagination.totalPages
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

export default AttendanceRecords;