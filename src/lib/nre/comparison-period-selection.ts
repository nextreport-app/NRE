import { reportCalendarYesterday } from "./report-period-selection";
import type { DateRangeIso } from "./date-range";

/** Pre-upload presets use the client calendar, independent of uploaded CSV bounds. */
export function comparisonPresetPeriods(preset: "thisWeek" | "last15" | "last30", now = new Date(), timezone = "UTC"): { periodA: DateRangeIso; periodB: DateRangeIso } {
  const yesterday = reportCalendarYesterday(now, timezone);
  const shift = (iso: string, days: number) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  const days = preset === "thisWeek" ? 7 : preset === "last15" ? 15 : 30;
  return { periodA: { startIso: shift(yesterday, -(days - 1)), endIso: yesterday }, periodB: { startIso: shift(yesterday, -(days * 2 - 1)), endIso: shift(yesterday, -days) } };
}
