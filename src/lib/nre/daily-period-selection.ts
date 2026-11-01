import { reportCalendarYesterday } from "./report-period-selection";
import type { DateRangeIso } from "./date-range";

export function dailyPresetRange(days: number, now = new Date(), timezone = "UTC"): DateRangeIso {
  const endIso = reportCalendarYesterday(now, timezone);
  const start = new Date(`${endIso}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { startIso: start.toISOString().slice(0, 10), endIso };
}

export function dailyPeriodLabel(range: DateRangeIso, now = new Date(), timezone = "UTC"): string {
  for (const days of [1, 7, 14, 30]) {
    const preset = dailyPresetRange(days, now, timezone);
    if (preset.startIso === range.startIso && preset.endIso === range.endIso) return days === 1 ? "Yesterday" : `Last ${days} days`;
  }
  return range.startIso === range.endIso ? "Single day" : "Custom date range";
}

export function dailyRangeLabel(range: DateRangeIso): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .formatRange(new Date(`${range.startIso}T12:00:00Z`), new Date(`${range.endIso}T12:00:00Z`));
}
