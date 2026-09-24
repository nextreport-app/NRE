/**
 * CSV download guidance for Meta reports — two user-facing rules:
 * 1) Client timezone day 1 → Previous Month + Day breakdown (close last month)
 * 2) All other days → Last 30 Days + Day breakdown
 *
 * Optional third upload (client settings): Previous Month Data for the Combined
 * Total comparison row — separate from the wizard CSV above.
 */

import { getDateRangeShortLabel, getMonthName, getCalendarDateInTimezone, parseDate } from "./dates";
import {
  computeCsvDateBounds,
  computeEffectiveYesterday,
  computeMtdRangeIso,
  computeWeeklyRangeOptions,
  type DateRangeIso,
} from "./date-range";
import type { NreRow } from "./columns";
import { getRowDate } from "./columns";

export type CsvDateWarningKind =
  | "first_of_month"
  | "missing_month_start"
  | "early_month_last30"
  /** Default weekly period spans days before the account had any delivery. */
  | "weekly_period_partial";

export interface CsvDateWarning {
  kind: CsvDateWarningKind;
  title: string;
  message: string;
  missingDateLabel?: string;
  csvStartLabel?: string;
  intendedMtdLabel?: string;
  weeklyRangeLabel?: string;
  suggestedDownload: "previous_month" | "last_30_days";
}

export interface CsvDateGuidance {
  downloadTip: string;
  /** Shown after upload only when the CSV is missing expected days — not a repeat of the upload tip. */
  warnings: CsvDateWarning[];
  /** True on the 1st when the CSV only contains the prior calendar month — a final monthly report. */
  suggestPreviousMonthReport: boolean;
  reportingMonthName: string | null;
  mtdRange: DateRangeIso | null;
  csvBounds: { minIso: string; maxIso: string } | null;
}

function friendlyDate(iso: string): string {
  const d = parseDate(iso);
  const month = getMonthName(iso);
  if (!d || !month) return iso;
  return `${month} ${d.day}`;
}

/**
 * Step 1 upload tip — client timezone calendar day.
 * Rule A: 1st → Previous Month. Rule B: everything else → Last 30 Days.
 */
export function getMetaCsvDownloadTip(now: Date = new Date(), timezone = "UTC"): string {
  const dayOfMonth = getCalendarDateInTimezone(now, timezone).day;

  if (dayOfMonth === 1) {
    return (
      "It's the 1st — export Previous Month with Day breakdown. " +
      "One file covers last week's slide and last month's totals."
    );
  }

  return "Export Last 30 Days with Day breakdown.";
}

function daysBetween(startIso: string, endIso: string): number {
  const startTs = Date.parse(startIso + "T00:00:00Z");
  const endTs = Date.parse(endIso + "T00:00:00Z");
  if (Number.isNaN(startTs) || Number.isNaN(endTs)) return 0;
  return Math.round((endTs - startTs) / (24 * 60 * 60 * 1000));
}

function isRangeWithinBounds(range: DateRangeIso, bounds: { minIso: string; maxIso: string }): boolean {
  return range.startIso >= bounds.minIso && range.endIso <= bounds.maxIso;
}

function monthStartPresentInCsv(rows: NreRow[], monthStartIso: string): boolean {
  return rows.some((row) => {
    const raw = getRowDate(row);
    const d = parseDate(raw);
    if (!d) return false;
    const iso = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    return iso === monthStartIso;
  });
}

/** Post-analyze — warn only when the uploaded CSV is missing days the report expects. */
export function analyzeCsvDateGuidance(rows: NreRow[], now: Date = new Date(), timezone = "UTC"): CsvDateGuidance {
  const downloadTip = getMetaCsvDownloadTip(now, timezone);
  const csvBounds = computeCsvDateBounds(rows);
  const mtdRange = computeMtdRangeIso(rows, now, timezone);
  const weeklyOptions = computeWeeklyRangeOptions(rows, now, timezone);
  const dayOfMonth = getCalendarDateInTimezone(now, timezone).day;

  if (!csvBounds || !mtdRange) {
    return {
      downloadTip,
      warnings: [],
      suggestPreviousMonthReport: false,
      reportingMonthName: null,
      mtdRange,
      csvBounds,
    };
  }

  const reportingMonthName = getMonthName(mtdRange.endIso);
  const intendedMtdLabel = getDateRangeShortLabel(mtdRange.startIso, mtdRange.endIso);
  const weeklyRangeLabel = weeklyOptions
    ? getDateRangeShortLabel(weeklyOptions.last7.startIso, weeklyOptions.last7.endIso)
    : undefined;

  const monthStartMissing =
    csvBounds.minIso > mtdRange.startIso && !monthStartPresentInCsv(rows, mtdRange.startIso);

  const warnings: CsvDateWarning[] = [];

  if (monthStartMissing) {
    const missingDateLabel = friendlyDate(mtdRange.startIso);
    const csvStartLabel = friendlyDate(csvBounds.minIso);
    const usePreviousMonth = dayOfMonth === 1;
    const gapFromMonthStart = daysBetween(mtdRange.startIso, csvBounds.minIso);
    const weeklyCovered = weeklyOptions ? isRangeWithinBounds(weeklyOptions.last7, csvBounds) : false;

    // Newer campaigns / API sync often start mid-month — no delivery before csv min.
    // When the default weekly window is fully covered, skip the scary re-export prompt.
    if (weeklyCovered && !usePreviousMonth) {
      // No warning — MTD/chart simply cover from first delivery day onward.
    } else if (
      !usePreviousMonth &&
      gapFromMonthStart > 2 &&
      weeklyOptions &&
      csvBounds.minIso > weeklyOptions.last7.startIso
    ) {
      warnings.push({
        kind: "weekly_period_partial",
        title: `Campaign data starts ${csvStartLabel}`,
        message: `There's no delivery before ${csvStartLabel} in this export — normal when campaigns went live recently. The default last-7-days period (${weeklyRangeLabel ?? "see Generate step"}) includes earlier dates with no activity. Pick a custom range from ${csvStartLabel} onward on the Generate step, or continue with partial weekly data.`,
        csvStartLabel,
        weeklyRangeLabel,
        suggestedDownload: "last_30_days",
      });
    } else {
      warnings.push({
        kind: usePreviousMonth ? "first_of_month" : "missing_month_start",
        title: `${missingDateLabel} missing from your CSV`,
        message: usePreviousMonth
          ? `Your file starts ${csvStartLabel}, so last month's totals skip ${missingDateLabel}. Re-export Previous Month (${intendedMtdLabel}) with Day breakdown.`
          : `Your file starts ${csvStartLabel}, so MTD skips ${missingDateLabel}. Re-export Last 30 Days with Day breakdown (${intendedMtdLabel}).`,
        missingDateLabel,
        csvStartLabel,
        intendedMtdLabel,
        weeklyRangeLabel,
        suggestedDownload: usePreviousMonth ? "previous_month" : "last_30_days",
      });
    }
  }

  const yesterday = computeEffectiveYesterday(rows, now, timezone);
  const suggestPreviousMonthReport =
    dayOfMonth === 1 &&
    !!yesterday &&
    csvBounds.maxIso === `${yesterday.year}-${String(yesterday.month).padStart(2, "0")}-${String(yesterday.day).padStart(2, "0")}` &&
    csvBounds.minIso > mtdRange.startIso;

  return {
    downloadTip,
    warnings,
    suggestPreviousMonthReport,
    reportingMonthName,
    mtdRange,
    csvBounds,
  };
}
