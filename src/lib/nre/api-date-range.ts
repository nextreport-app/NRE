import { getCalendarDateInTimezone } from "./dates";

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatIsoUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Full prior calendar month in the client's timezone — used for Previous Month Data API sync. */
export function computePreviousCalendarMonthIsoRange(
  now: Date,
  timezone: string,
): { sinceIso: string; untilIso: string } {
  const { year, month } = getCalendarDateInTimezone(now, timezone);
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const since = new Date(Date.UTC(prevYear, prevMonth - 1, 1));
  const until = new Date(Date.UTC(prevYear, prevMonth - 1, daysInMonth(prevYear, prevMonth)));
  return { sinceIso: formatIsoUtc(since), untilIso: formatIsoUtc(until) };
}

/** Last N calendar days ending today in the client's timezone (inclusive). */
export function computeLastNDaysIsoRange(
  now: Date,
  timezone: string,
  days = 30,
): { sinceIso: string; untilIso: string } {
  const today = getCalendarDateInTimezone(now, timezone);
  const until = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return { sinceIso: fmt(since), untilIso: fmt(until) };
}
