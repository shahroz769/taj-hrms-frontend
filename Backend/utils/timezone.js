import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const PAKISTAN_TZ = "Asia/Karachi";

const pad2 = (value) => String(value).padStart(2, "0");

export const getCurrentPKYearMonth = () => {
  const now = new Date();
  const year = Number(formatInTimeZone(now, PAKISTAN_TZ, "yyyy"));
  const month = Number(formatInTimeZone(now, PAKISTAN_TZ, "MM"));
  return { year, month };
};

export const isMonthClosedInPakistanTime = (year, month) => {
  const targetYear = Number(year);
  const targetMonth = Number(month);

  const nextYear = targetMonth === 12 ? targetYear + 1 : targetYear;
  const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;

  const nextMonthStartLocal = `${nextYear}-${pad2(nextMonth)}-01T00:00:00`;
  const nextMonthStartUtc = fromZonedTime(nextMonthStartLocal, PAKISTAN_TZ);

  return new Date() >= nextMonthStartUtc;
};

export const getMonthStartEndUtcForPakistan = (year, month) => {
  const y = Number(year);
  const m = Number(month);

  const monthStartLocal = `${y}-${pad2(m)}-01T00:00:00`;
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextMonthStartLocal = `${nextYear}-${pad2(nextMonth)}-01T00:00:00`;

  const monthStartUtc = fromZonedTime(monthStartLocal, PAKISTAN_TZ);
  const nextMonthStartUtc = fromZonedTime(nextMonthStartLocal, PAKISTAN_TZ);

  return { monthStartUtc, nextMonthStartUtc };
};
