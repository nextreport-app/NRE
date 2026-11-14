import { computeMtdRangeIso } from "./date-range";
import type { DateSelection } from "../validators/report-wizard";
import type { DateRangeIso } from "./date-range";
import { computeWeeklyRangeOptions } from "./date-range";
import { computeLastNDaysIsoRange } from "./api-date-range";
import { historicalPeriods, reportCalendarYesterday, selectedSinglePeriod } from "./report-period-selection";
import { comparisonPresetPeriods } from "./comparison-period-selection";
export interface MetaApiReportSelection {
  reportType?: string;
  dateSelection?: DateSelection;
  comparisonPeriodA?: DateRangeIso;
  comparisonPeriodB?: DateRangeIso;
  historicalMonthCount?: number;
}
/** Same account calendar/period rules as CSV; weekly additionally needs its rolling chart window. */
export function metaApiImportRange(selection: MetaApiReportSelection, now: Date, timezone: string): { sinceIso: string; untilIso: string } {
  const type = selection.reportType ?? "WEEKLY";
  const yesterday = reportCalendarYesterday(now, timezone);
  const custom = selection.dateSelection?.mode === "custom" ? { startIso: selection.dateSelection.customStart ?? "", endIso: selection.dateSelection.customEnd ?? "" } : undefined;
  let ranges: DateRangeIso[];
  if (type === "WEEKLY") {
    const rolling = computeLastNDaysIsoRange(now, timezone, 30);
    const weekly = computeWeeklyRangeOptions([], now, timezone);
    const range = custom ?? (selection.dateSelection?.mode === "prev7" ? weekly.prev7 : selection.dateSelection?.mode === "last14" ? weekly.last14 : weekly.last7);
    ranges = [{ startIso: rolling.sinceIso, endIso: rolling.untilIso }, range, computeMtdRangeIso([], now, timezone)];
  } else if (type === "MONTHLY" || type === "DAILY") {
    ranges = [selectedSinglePeriod(type, selection.dateSelection, now, timezone)!];
  } else if (type === "HISTORICAL") {
    ranges = historicalPeriods(selection.historicalMonthCount ?? 3, custom?.endIso.slice(0, 7), !!custom, now, timezone);
  } else if (type === "COMPARISON") {
    const defaults = comparisonPresetPeriods("thisWeek", now, timezone);
    ranges = [selection.comparisonPeriodA ?? defaults.periodA, selection.comparisonPeriodB ?? defaults.periodB];
  } else if (type === "DAY_BREAKDOWN") {
    ranges = [custom ?? computeWeeklyRangeOptions([], now, timezone).last7];
  } else throw new Error("Choose a supported Meta report type.");
  for (const range of ranges) {
    const valid = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(iso + "T00:00:00Z")) && new Date(iso + "T00:00:00Z").toISOString().slice(0, 10) === iso;
    if (!valid(range.startIso) || !valid(range.endIso) || range.startIso > range.endIso || range.endIso > yesterday) throw new Error("Choose valid reporting dates ending yesterday or earlier in the ad account timezone.");
  }
  const sinceIso = ranges.map(range => range.startIso).sort()[0];
  const untilIso = ranges.map(range => range.endIso).sort().at(-1)!;
  if ((Date.parse(untilIso) - Date.parse(sinceIso)) / 86400000 > 366) throw new Error("API imports support a maximum span of 12 months. Choose a shorter range.");
  return { sinceIso, untilIso };
}
