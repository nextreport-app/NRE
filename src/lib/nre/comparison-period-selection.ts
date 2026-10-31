import { reportCalendarYesterday } from "./report-period-selection";
import type { DateRangeIso } from "./date-range";

/** Pre-upload presets use the client calendar, independent of uploaded CSV bounds. */
export function comparisonPresetPeriods(preset: "thisWeek" | "thisMonth", now = new Date(), timezone = "UTC"): { periodA: DateRangeIso; periodB: DateRangeIso } {
  const yesterday = reportCalendarYesterday(now, timezone);
  const shift = (iso: string, days: number) => { const date = new Date(`${iso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  if (preset === "thisWeek") return { periodA: { startIso: shift(yesterday, -6), endIso: yesterday }, periodB: { startIso: shift(yesterday, -13), endIso: shift(yesterday, -7) } };
  const next = new Date(`${shift(yesterday, 1).slice(0, 7)}-01T12:00:00Z`);
  const monthRange = (offset: number) => { const date = new Date(next); date.setUTCMonth(date.getUTCMonth() + offset); const startIso = date.toISOString().slice(0, 10); date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); return { startIso, endIso: date.toISOString().slice(0, 10) }; };
  return { periodA: monthRange(-1), periodB: monthRange(-2) };
}
