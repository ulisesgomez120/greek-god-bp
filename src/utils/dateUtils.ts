import {
  startOfWeek as dfStartOfWeek,
  addDays,
  format,
  differenceInCalendarWeeks,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  isSameYear,
} from "date-fns";

export type WeekStart = 0 | 1; // 0 = Sunday, 1 = Monday

/**
 * Returns the start-of-week Date for the given date using the provided week start convention.
 */
export function startOfWeek(date: Date | string, weekStartsOn: WeekStart = 0): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return dfStartOfWeek(d, { weekStartsOn });
}

/**
 * Returns a compact human-friendly label for a week range.
 * Examples: "Oct 21–27" or "Dec 30 – Jan 5, 2025" when the week spans years.
 */
export function getWeekLabel(startDate: Date | string, weekStartsOn: WeekStart = 0): string {
  const start = startOfWeek(typeof startDate === "string" ? new Date(startDate) : startDate, weekStartsOn);
  const end = addDays(start, 6);

  const sameYear = isSameYear(start, end);
  const startFmt = format(start, "MMM d");
  const endFmt = sameYear ? format(end, "MMM d") : format(end, "MMM d, yyyy");

  return `${startFmt}		6${endFmt.replace(/^\s+/, "").replace(/\s{2,}/, " ")}`.replace("\u0009\u00096", "–");
}

/**
 * Friendly relative formatter: Today, Yesterday, "3 days ago", or fallback to a formatted date.
 */
export function formatRelative(date: Date | string, now: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const n = typeof now === "string" ? new Date(now) : now;

  const daysDiff = differenceInCalendarDays(n, d);
  if (daysDiff === 0) return "Today";
  if (daysDiff === 1) return "Yesterday";
  if (daysDiff < 7) return `${daysDiff} days ago`;
  if (daysDiff < 30) {
    const weeks = Math.floor(daysDiff / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  return format(d, "MMM d, yyyy");
}

/**
 * Number of calendar weeks between two dates, respecting the weekStartsOn convention.
 * This uses date-fns differenceInCalendarWeeks which counts the number of calendar week boundaries between dates.
 */
export function weeksBetween(start: Date | string, end: Date | string, weekStartsOn: WeekStart = 0): number {
  const a = typeof start === "string" ? new Date(start) : start;
  const b = typeof end === "string" ? new Date(end) : end;
  return Math.abs(differenceInCalendarWeeks(b, a, { weekStartsOn }));
}

/**
 * Generate a month range object for the month that contains the provided date.
 * Returns { start: Date, end: Date } using local timezone semantics.
 */
export function generateMonthRange(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return {
    start: startOfMonth(d),
    end: endOfMonth(d),
  };
}

/**
 * Generate an array of month start dates between two dates (inclusive of start month, exclusive of end month by default).
 * Useful for building month-bucketed series.
 */
export function generateMonthsBetween(start: Date | string, end: Date | string) {
  const s = startOfMonth(typeof start === "string" ? new Date(start) : start);
  const e = startOfMonth(typeof end === "string" ? new Date(end) : end);
  const months: Date[] = [];
  let cursor = s;
  while (cursor <= e) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
}
