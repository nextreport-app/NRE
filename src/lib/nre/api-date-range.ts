import { getCalendarDateInTimezone } from "./dates";

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
