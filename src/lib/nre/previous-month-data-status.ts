import { getCalendarDateInTimezone } from "./dates";

const MONTHS = [
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
] as const;

export type PreviousMonthDataStatus = "missing" | "stale" | "current";

export interface PreviousMonthComparisonInfo {
  status: PreviousMonthDataStatus;
  /** Calendar month the comparison row should reflect (last completed month). */
  expectedMonthName: string;
  /** When the stored file was last uploaded, if known. */
  uploadedAt: Date | null;
}

/** First instant of the current calendar month in the client's timezone (UTC ms). */
function startOfCurrentMonthMs(now: Date, timezone: string): number {
  const { year, month } = getCalendarDateInTimezone(now, timezone);
  return Date.UTC(year, month - 1, 1);
}

function previousMonthName(now: Date, timezone: string): string {
  const { year, month } = getCalendarDateInTimezone(now, timezone);
  if (month === 1) return MONTHS[11]!;
  return MONTHS[month - 2]!;
}

/**
 * Whether the client's stored Previous Month Data is ready for reports this month.
 * "Stale" = file exists but was not uploaded/refreshed since the current calendar month began.
 */
export function getPreviousMonthComparisonInfo(
  hasFile: boolean,
  updatedAtIso: string | null,
  timezone: string,
  now: Date = new Date(),
): PreviousMonthComparisonInfo {
  const expectedMonthName = previousMonthName(now, timezone);
  const uploadedAt = updatedAtIso ? new Date(updatedAtIso) : null;

  if (!hasFile || !uploadedAt || Number.isNaN(uploadedAt.getTime())) {
    return { status: "missing", expectedMonthName, uploadedAt: null };
  }

  const monthStartMs = startOfCurrentMonthMs(now, timezone);
  if (uploadedAt.getTime() < monthStartMs) {
    return { status: "stale", expectedMonthName, uploadedAt };
  }

  return { status: "current", expectedMonthName, uploadedAt };
}
