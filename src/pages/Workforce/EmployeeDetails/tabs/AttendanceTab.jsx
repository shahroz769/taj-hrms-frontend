// React
import { useCallback, useMemo, useState } from "react";

// React Router
import { useSearchParams } from "react-router";

// External
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right";
import LoaderCircleIcon from "lucide-react/dist/esm/icons/loader-circle";

// Components
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

// Pages / Modals
import AttendanceCellEditModal from "@/pages/Attendance/AttendanceCellEditModal";

// Services
import { fetchEmployeeMonthlyAttendance } from "@/services/attendancesApi";
import { fetchEmployeeShiftOnDate } from "@/services/employeeShiftsApi";

// Styles
import styles from "../EmployeeDetails.module.css";

// =============================================================================
// CONSTANTS
// =============================================================================

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_CLASS = {
  Present: styles.statePresent,
  Absent: styles.stateAbsent,
  Leave: styles.stateLeave,
  "Paid Leave": styles.stateLeave,
  "Unpaid Leave": styles.stateLeave,
  Late: styles.stateLate,
  "Half Day": styles.stateHalfDay,
  Off: styles.stateDayOff,
  "Day Off": styles.stateDayOff,
  Holiday: styles.stateHoliday,
};

// =============================================================================
// COMPONENT
// =============================================================================

const today = new Date();

const parseMonthParam = (value) => {
  if (value === null) return today.getMonth();
  const month = Number(value);
  return Number.isInteger(month) && month >= 0 && month <= 11
    ? month
    : today.getMonth();
};

const AttendanceTab = ({ employeeId, employeeName }) => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedYear, setSelectedYear] = useState(
    () => Number(searchParams.get("attendanceYear")) || today.getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState(
    () => parseMonthParam(searchParams.get("attendanceMonth")),
  );
  const [cellEditOpen, setCellEditOpen] = useState(false);
  const [cellEditData, setCellEditData] = useState(null);
  const [loadingDay, setLoadingDay] = useState(null);

  const updateAttendanceUrl = useCallback((year, month) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", "attendance");
      next.set("attendanceYear", String(year));
      next.set("attendanceMonth", String(month));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-monthly-attendance", employeeId, selectedYear, selectedMonth],
    queryFn: () =>
      fetchEmployeeMonthlyAttendance(employeeId, {
        year: selectedYear,
        month: selectedMonth,
      }),
  });

  const records = useMemo(() => {
    if (Array.isArray(data)) return data;
    return data?.records || data?.attendances || [];
  }, [data]);

  const recordsByDay = useMemo(() => {
    const map = new Map();
    for (const rec of records) {
      const date = rec.date ? new Date(rec.date) : null;
      if (!date) continue;
      map.set(date.getDate(), rec);
    }
    return map;
  }, [records]);

  const daysInMonth = useMemo(
    () => new Date(selectedYear, selectedMonth + 1, 0).getDate(),
    [selectedYear, selectedMonth],
  );

  const firstDayOffset = useMemo(
    () => new Date(selectedYear, selectedMonth, 1).getDay(),
    [selectedYear, selectedMonth],
  );

  const yearOptions = useMemo(() => {
    const current = today.getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - 4 + i);
  }, []);

  const setPeriod = useCallback((year, month) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    updateAttendanceUrl(year, month);
  }, [updateAttendanceUrl]);

  const goPrev = () => {
    const nextYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const nextMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    setPeriod(nextYear, nextMonth);
  };

  const goNext = () => {
    const nextYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const nextMonth = selectedMonth === 11 ? 0 : selectedMonth + 1;
    setPeriod(nextYear, nextMonth);
  };

  const handleCellClick = useCallback(async (day, record) => {
    const date = new Date(Date.UTC(selectedYear, selectedMonth, day));
    const month = String(selectedMonth + 1).padStart(2, "0");
    const dateDay = String(day).padStart(2, "0");
    const dateStr = `${selectedYear}-${month}-${dateDay}`;
    const recordHasShift = !!(
      record?.shift?._id || (typeof record?.shift === "string" && record.shift)
    );

    let preloadedShift = null;
    if (!recordHasShift) {
      setLoadingDay(day);
      try {
        preloadedShift = await queryClient.fetchQuery({
          queryKey: ["employee-shift-on-date", employeeId, dateStr],
          queryFn: () => fetchEmployeeShiftOnDate({ employeeId, date: dateStr }),
          staleTime: 60_000,
        });
      } catch {
        // Open the modal without a pre-selected shift; the user can pick one.
      } finally {
        setLoadingDay(null);
      }
    }

    setCellEditData({
      employeeId,
      employeeName: employeeName || "Employee",
      date,
      dateStr,
      record: record || null,
      preloadedShift,
    });
    setCellEditOpen(true);
  }, [employeeId, employeeName, queryClient, selectedMonth, selectedYear]);

  return (
    <div>
      <div className={styles.calendarToolbar}>
        <div className={styles.calendarToolbarSelectors}>
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeftIcon size={16} />
          </Button>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setPeriod(selectedYear, Number(v))}
          >
            <SelectTrigger className="w-35">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setPeriod(Number(v), selectedMonth)}
          >
            <SelectTrigger className="w-25">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRightIcon size={16} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.spinnerWrap}>
          <Spinner />
        </div>
      ) : isError ? (
        <div className={styles.empty}>Failed to load attendance</div>
      ) : (
        <div className={styles.calendarGrid}>
          {DAY_HEADERS.map((d) => (
            <div key={d} className={styles.calendarHeader}>
              {d}
            </div>
          ))}

          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className={`${styles.calendarCell} ${styles.calendarCellEmpty}`}
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const rec = recordsByDay.get(day);
            const status = rec?.status;
            const isCellLoading = loadingDay === day;
            const isToday =
              today.getFullYear() === selectedYear &&
              today.getMonth() === selectedMonth &&
              today.getDate() === day;

            return (
              <div
                key={day}
                className={`${styles.calendarCell} ${
                  isToday ? styles.calendarCellToday : ""
                } ${styles.calendarCellClickable}`}
                onClick={
                  isCellLoading ? undefined : () => handleCellClick(day, rec)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    if (!isCellLoading) handleCellClick(day, rec);
                  }
                }}
              >
                <div className={styles.calendarDay}>{day}</div>
                {isCellLoading ? (
                  <LoaderCircleIcon
                    size={16}
                    className="mt-1 text-primary animate-spin"
                  />
                ) : status ? (
                  <span
                    className={`${styles.calendarStatus} ${
                      STATUS_CLASS[status] || styles.stateNone
                    }`}
                  >
                    {status}
                  </span>
                ) : (
                  <span
                    className={`${styles.calendarStatus} ${styles.stateNone}`}
                  >
                    —
                  </span>
                )}
                {rec?.shift?.name ? (
                  <div className={styles.calendarMeta}>{rec.shift.name}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {cellEditData ? (
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
      ) : null}
    </div>
  );
};

export default AttendanceTab;
