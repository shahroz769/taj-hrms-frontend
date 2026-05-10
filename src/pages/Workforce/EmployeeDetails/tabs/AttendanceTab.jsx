// React
import { useMemo, useState } from "react";

// External
import { useQuery } from "@tanstack/react-query";
import ChevronLeftIcon from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRightIcon from "lucide-react/dist/esm/icons/chevron-right";

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

// Services
import { fetchEmployeeMonthlyAttendance } from "@/services/attendancesApi";

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
  "Day Off": styles.stateDayOff,
  Holiday: styles.stateHoliday,
};

// =============================================================================
// COMPONENT
// =============================================================================

const today = new Date();

const AttendanceTab = ({ employeeId }) => {
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employee-monthly-attendance", employeeId, selectedYear, selectedMonth],
    queryFn: () =>
      fetchEmployeeMonthlyAttendance(employeeId, {
        year: selectedYear,
        month: selectedMonth,
      }),
  });

  const records = data?.records || data?.attendances || data || [];

  const recordsByDay = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(records) ? records : [];
    for (const rec of list) {
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

  const goPrev = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  return (
    <div>
      <div className={styles.calendarToolbar}>
        <div className={styles.calendarToolbarSelectors}>
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeftIcon size={16} />
          </Button>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
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
            onValueChange={(v) => setSelectedYear(Number(v))}
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
            const isToday =
              today.getFullYear() === selectedYear &&
              today.getMonth() === selectedMonth &&
              today.getDate() === day;

            return (
              <div
                key={day}
                className={`${styles.calendarCell} ${
                  isToday ? styles.calendarCellToday : ""
                }`}
              >
                <div className={styles.calendarDay}>{day}</div>
                {status ? (
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
    </div>
  );
};

export default AttendanceTab;
