import { getCalendarDateInTimezone } from "./dates";
import { getCalendarYesterday } from "./date-range";

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

/** Last N calendar days ending yesterday in the client's timezone (inclusive). Today's data is incomplete. */
export function computeLastNDaysIsoRange(
  now: Date,
  timezone: string,
  days = 30,
): { sinceIso: string; untilIso: string } {
  const yesterday = getCalendarYesterday(now, timezone);
  const until = new Date(Date.UTC(yesterday.year, yesterday.month - 1, yesterday.day));
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return { sinceIso: fmt(since), untilIso: fmt(until) };
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Splits a date range into smaller chunks — used when an ad platform rejects a full-range request. */
export function splitIsoDateRangeIntoChunks(
  sinceIso: string,
  untilIso: string,
  chunkDays = 7,
): { sinceIso: string; untilIso: string }[] {
  const chunks: { sinceIso: string; untilIso: string }[] = [];
  let cursor = parseIsoDate(sinceIso);
  const end = parseIsoDate(untilIso);

  while (cursor <= end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ sinceIso: formatIsoUtc(cursor), untilIso: formatIsoUtc(chunkEnd) });
    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return chunks;
}
