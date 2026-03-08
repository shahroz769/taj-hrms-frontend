// React
import { useCallback, useEffect, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External Libraries
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right";
import CircleXIcon from "lucide-react/dist/esm/icons/circle-x";
import ClipboardListIcon from "lucide-react/dist/esm/icons/clipboard-list";
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle";
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

// Pages / Modals
import AttendanceCellEditModal from "./AttendanceCellEditModal";
import MarkAttendanceModal from "../Workforce/MarkAttendanceModal";

// Services
import { fetchMonthlyAttendance } from "@/services/attendancesApi";
import { fetchEmployeeShiftOnDate } from "@/services/employeeShiftsApi";

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

/** Full day name as used in shift workingDays (e.g. "Monday") */
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const queryClient = useQueryClient();

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

  // Cell edit modal state
  const [cellEditOpen, setCellEditOpen] = useState(false);
  const [cellEditData, setCellEditData] = useState(null);
  const [loadingCellKey, setLoadingCellKey] = useState(null);

  // Mark Attendance modal state
  const [markAttendanceOpen, setMarkAttendanceOpen] = useState(false);

  // ===========================================================================
  // DERIVED DATA
  // ===========================================================================
  const days = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth],
  );

  // ===========================================================================
  // TANSTACK QUERY
  // ===========================================================================
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      "attendance-monthly",
      { year: selectedYear, month: selectedMonth, page, limit, search: debouncedSearch },
    ],
    queryFn: () =>
      fetchMonthlyAttendance({
        year: selectedYear,
        month: selectedMonth,
        page,
        limit,
        search: debouncedSearch,
      }),
    placeholderData: (prev) => prev,
  });

  const attendanceData = data?.employees || [];
  const pagination = data?.pagination;

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
  }, [
    selectedMonth,
    selectedYear,
    limit,
    page,
    debouncedSearch,
    setSearchParams,
  ]);

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

  // Cell click: open edit modal
  const handleCellClick = useCallback(async (emp, day, record) => {
    const date = new Date(Date.UTC(selectedYear, selectedMonth, day));
    const mo = String(selectedMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${selectedYear}-${mo}-${dd}`;

    const recordHasShift = !!(
      record?.shift?._id || (typeof record?.shift === "string" && record.shift)
    );

    let preloadedShift = null;
    if (!recordHasShift) {
      const cellKey = `${emp._id}-${day}`;
      setLoadingCellKey(cellKey);
      try {
        preloadedShift = await queryClient.fetchQuery({
          queryKey: ["employee-shift-on-date", emp._id, dateStr],
          queryFn: () => fetchEmployeeShiftOnDate({ employeeId: emp._id, date: dateStr }),
          staleTime: 60_000,
        });
      } catch {
        // ignore — modal will open without a pre-selected shift
      } finally {
        setLoadingCellKey(null);
      }
    }

    setCellEditData({
      employeeId: emp._id,
      employeeName: emp.fullName,
      date,
      dateStr,
      record: record || null,
      preloadedShift,
    });
    setCellEditOpen(true);
  }, [selectedYear, selectedMonth, queryClient]);

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const renderBadge = useCallback((record) => {
    if (record === "before_joining") {
      return <span className={styles.badgeNA}>NA</span>;
    }
    if (record === null || record === undefined) {
      return <span className={styles.badgeFuture}>—</span>;
    }
    const status = record.status;
    const statusConfig = {
      Present: { cls: styles.badgeP, label: "P" },
      Absent: { cls: styles.badgeA, label: "A" },
      Late: { cls: styles.badgeP, label: "P", cornerLabel: "L", cornerCls: styles.cornerBadgeLate },
      "Half Day": { cls: styles.badgeP, label: "P", cornerLabel: "HD", cornerCls: styles.cornerBadgeHalfDay },
      Off: { cls: styles.badgeOff, label: "Off" },
      Leave: { cls: styles.badgeL, label: "L" },
    };
    const config = statusConfig[status];
    if (!config) return <span className={styles.badgeFuture}>—</span>;
    return (
      <span className={styles.cellBadgeWrapper}>
        <span className={config.cls}>{config.label}</span>
        {config.cornerLabel && (
          <span className={config.cornerCls}>{config.cornerLabel}</span>
        )}
      </span>
    );
  }, []);

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Attendance Records</h1>
        <div className="flex items-center gap-3">
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
          <Button
            variant="green"
            className="cursor-pointer shrink-0"
            onClick={() => setMarkAttendanceOpen(true)}
          >
            <ClipboardListIcon size={16} />
            Mark Attendance
          </Button>
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
            {isFetching && debouncedSearch ? (
              <Spinner />
            ) : debouncedSearch ? (
              <CircleXIcon />
            ) : null}
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
                  const todayFlag = isToday(selectedYear, selectedMonth, day);
                  const headerClass = todayFlag
                    ? styles.dateHeaderToday
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
                <th className={`${styles.summaryHeader} ${styles.summaryP}`}>
                  P
                </th>
                <th className={`${styles.summaryHeader} ${styles.summaryA}`}>
                  A
                </th>
                <th className={`${styles.summaryHeader} ${styles.summaryL}`}>
                  L
                </th>
                <th className={`${styles.summaryHeader} ${styles.summaryOff}`}>
                  Off
                </th>
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
              ) : isError ? (
                <tr>
                  <td colSpan={days.length + 5}>
                    <div className={styles.stateContainer}>
                      <p className={styles.stateText}>
                        Failed to load attendance data.{" "}
                        <button
                          onClick={() => refetch()}
                          className="text-[#02542D] underline"
                        >
                          Retry
                        </button>
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
                attendanceData.map((row) => (
                  <tr key={row.employee._id}>
                    {/* Sticky employee column */}
                    <td className={styles.stickyCell}>
                      <div className={styles.employeeName}>
                        {row.employee.fullName}
                      </div>
                      <div className={styles.employeeId}>
                        {row.employee.employeeID}
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map((day) => {
                      const record = row.records[day];
                      const dow = getDayOfWeek(selectedYear, selectedMonth, day);
                      const dayName = DAY_FULL[dow];
                      const workingDays = row.shiftWorkingDays;
                      const isOffDay = workingDays
                        ? !workingDays.includes(dayName)
                        : false;
                      const isFutureDate = record === null;
                      const isBeforeJoining = record === "before_joining";
                      const cellKey = `${row.employee._id}-${day}`;
                      const isCellLoading = loadingCellKey === cellKey;
                      return (
                        <td
                          key={day}
                          className={
                            isBeforeJoining
                              ? styles.attendanceCell
                              : isOffDay
                                ? `${styles.attendanceCellOff}${!isFutureDate ? ` ${styles.clickableCell}` : ""}`
                                : `${styles.attendanceCell}${!isFutureDate ? ` ${styles.clickableCell}` : ""}`
                          }
                          onClick={
                            !isFutureDate && !isBeforeJoining && !isCellLoading
                              ? () => handleCellClick(row.employee, day, record)
                              : undefined
                          }
                        >
                          {isCellLoading ? (
                            <LoaderCircleIcon
                              size={16}
                              className="mx-auto text-[#02542D] animate-spin"
                            />
                          ) : (
                            renderBadge(record)
                          )}
                        </td>
                      );
                    })}

                    {/* Summary cells */}
                    <td
                      className={`${styles.summaryCell} ${styles.summaryP}`}
                    >
                      {(row.summary?.present || 0) + (row.summary?.late || 0) + (row.summary?.halfDay || 0)}
                    </td>
                    <td
                      className={`${styles.summaryCell} ${styles.summaryA}`}
                    >
                      {row.summary?.absent || 0}
                    </td>
                    <td
                      className={`${styles.summaryCell} ${styles.summaryL}`}
                    >
                      {row.summary?.leave || 0}
                    </td>
                    <td
                      className={`${styles.summaryCell} ${styles.summaryOff}`}
                    >
                      {row.summary?.off || 0}
                    </td>
                  </tr>
                ))
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

      {/* Cell Edit Modal — key forces remount so lazy state initializers reflect new cell data */}
      {cellEditData && (
        <AttendanceCellEditModal
          key={`${cellEditData.employeeId}-${cellEditData.date?.toISOString()}`}
          open={cellEditOpen}
          onOpenChange={setCellEditOpen}
          employeeId={cellEditData.employeeId}
          employeeName={cellEditData.employeeName}
          date={cellEditData.date}
          dateStr={cellEditData.dateStr}
          record={cellEditData.record}
          preloadedShift={cellEditData.preloadedShift}
        />
      )}

      {/* Mark Attendance Modal */}
      <MarkAttendanceModal
        open={markAttendanceOpen}
        onOpenChange={setMarkAttendanceOpen}
        preSelectedEmployeeIds={null}
      />
    </div>
  );
};

export default AttendanceRecords;
