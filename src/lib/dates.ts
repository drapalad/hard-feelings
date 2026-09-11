import { WEEKDAYS, type Weekday } from "@/types";

const MS_PER_DAY = 86_400_000;

export function weekdayOf(isoDate: string): Weekday {
  const [year, month, day] = isoDate.split("-").map(Number);
  const sundayIndexed = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAYS[(sundayIndexed + 6) % 7];
}

export function utcDayDiff(later: string, earlier: string): number {
  const [ly, lm, ld] = later.split("-").map(Number);
  const [ey, em, ed] = earlier.split("-").map(Number);
  return Math.round((Date.UTC(ly, lm - 1, ld) - Date.UTC(ey, em - 1, ed)) / MS_PER_DAY);
}

export function addUtcDays(isoDate: string, n: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day) + n * MS_PER_DAY;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utcMondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return addUtcDays(isoDate, offset);
}

export function weekDates(weekStart: string): string[] {
  const monday = utcMondayOf(weekStart);
  return [0, 1, 2, 3, 4, 5, 6].map((n) => addUtcDays(monday, n));
}

export function utcMonthStart(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${year}-${month}-01`;
}

export function addUtcMonths(isoDate: string, n: number): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + n, 1)).toISOString().slice(0, 10);
}

export function inclusiveIsoDates(from: string, to: string): string[] {
  if (from > to) {
    return [];
  }
  const dates: string[] = [];
  for (let current = from; current <= to; current = addUtcDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

function utcMonthLast(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export function monthGridDates(monthStart: string): string[] {
  const start = utcMondayOf(utcMonthStart(monthStart));
  const last = utcMonthLast(monthStart);
  const end = addUtcDays(utcMondayOf(last), 6);
  return inclusiveIsoDates(start, end);
}

export function activeWeekStartForMonth(monthStart: string, today: string): string {
  if (utcMonthStart(today) === utcMonthStart(monthStart)) {
    return utcMondayOf(today);
  }
  return utcMondayOf(monthStart);
}

export function formatMonthYear(monthStart: string): string {
  const [year, month, day] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
