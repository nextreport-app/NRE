/**
 * CSV download guidance and post-upload date-range warnings for the
 * beginning-of-month edge cases (Last 30 Days vs This Month vs Previous Month).
 */

import { getDateRangeShortLabel, getMonthName, parseDate } from "./dates";
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
  | "early_month_last30";

export interface CsvDateWarning {
  kind: CsvDateWarningKind;
  title: string;
  message: string;
  missingDateLabel?: string;
  csvStartLabel?: string;
  intendedMtdLabel?: string;
  weeklyRangeLabel?: string;
  suggestedDownload: "previous_month" | "this_month" | "last_30_days";
}

export interface CsvDateGuidance {
  downloadTip: string;
  warnings: CsvDateWarning[];
  /** True on the 1st when the CSV only contains the prior calendar month — a final monthly report. */
  suggestPreviousMonthReport: boolean;
  reportingMonthName: string | null;
  mtdRange: DateRangeIso | null;
  csvBounds: { minIso: string; maxIso: string } | null;
}

function ordinalDay(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function friendlyDate(iso: string): string {
  const d = parseDate(iso);
  const month = getMonthName(iso);
  if (!d || !month) return iso;
  return `${month} ${d.day}`;
}

/** Dynamic Meta CSV download tip shown on Step 1 before upload. */
export function getMetaCsvDownloadTip(now: Date = new Date()): string {
  const dayOfMonth = now.getUTCDate();

  if (dayOfMonth === 1) {
    return (
      "Today is the 1st — download one Previous Month CSV (daily breakdown). " +
      "One file covers weekly and monthly slides. Do not use Last 30 Days."
    );
  }

  if (dayOfMonth <= 7) {
    return (
      `Today is the ${ordinalDay(dayOfMonth)} — select Last 30 Days (not This Month) with Day breakdown ` +
      "so your weekly slide has a full 7 days."
    );
  }

  return "Select This Month in Meta Ads Manager with Day breakdown — month-to-date through yesterday.";
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

/** Post-analyze guidance — compares CSV bounds to the intended MTD calendar window. */
export function analyzeCsvDateGuidance(rows: NreRow[], now: Date = new Date()): CsvDateGuidance {
  const downloadTip = getMetaCsvDownloadTip(now);
  const csvBounds = computeCsvDateBounds(rows);
  const mtdRange = computeMtdRangeIso(rows, now);
  const weeklyOptions = computeWeeklyRangeOptions(rows, now);
  const dayOfMonth = now.getUTCDate();

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

  if (dayOfMonth === 1) {
    if (monthStartMissing) {
      const missingDateLabel = friendlyDate(mtdRange.startIso);
      const csvStartLabel = friendlyDate(csvBounds.minIso);
      warnings.push({
        kind: "first_of_month",
        title: `${reportingMonthName ?? "Last month"} report — ${missingDateLabel} missing from CSV`,
        message:
          `Your file starts ${csvStartLabel}, so monthly totals skip ${missingDateLabel}. ` +
          `Re-download one Previous Month export (${intendedMtdLabel}, Day breakdown) from Meta Ads Manager — one file covers weekly and monthly slides. ` +
          "Choose Monthly report type when you generate.",
        missingDateLabel,
        csvStartLabel,
        intendedMtdLabel,
        weeklyRangeLabel,
        suggestedDownload: "previous_month",
      });
    } else {
      warnings.push({
        kind: "first_of_month",
        title: `Closing ${reportingMonthName ?? "last month"}'s report`,
        message:
          `On the 1st, download one Previous Month CSV (${intendedMtdLabel}, Day breakdown). ` +
          "One file covers your weekly slide and monthly overview — do not use Last 30 Days. " +
          "Choose Monthly report type when you generate.",
        intendedMtdLabel,
        weeklyRangeLabel,
        suggestedDownload: "previous_month",
      });
    }
  } else if (dayOfMonth <= 7) {
    if (monthStartMissing) {
      const missingDateLabel = friendlyDate(mtdRange.startIso);
      const csvStartLabel = friendlyDate(csvBounds.minIso);
      warnings.push({
        kind: "early_month_last30",
        title: `${missingDateLabel} missing — weekly slide may be short`,
        message:
          `Your CSV starts ${csvStartLabel}. Re-download Last 30 Days (Day breakdown) from Meta Ads Manager so totals include ${missingDateLabel}. ` +
          `MTD overview will show ${intendedMtdLabel}.`,
        missingDateLabel,
        csvStartLabel,
        intendedMtdLabel,
        weeklyRangeLabel,
        suggestedDownload: "last_30_days",
      });
    } else {
      warnings.push({
        kind: "early_month_last30",
        title: "Early in the month — use Last 30 Days",
        message:
          `Select Last 30 Days (not This Month) when downloading so your weekly slide has a full 7 days. ` +
          `MTD overview: ${intendedMtdLabel}.`,
        intendedMtdLabel,
        weeklyRangeLabel,
        suggestedDownload: "last_30_days",
      });
    }
  } else if (monthStartMissing) {
    const missingDateLabel = friendlyDate(mtdRange.startIso);
    const csvStartLabel = friendlyDate(csvBounds.minIso);
    warnings.push({
      kind: "missing_month_start",
      title: `${missingDateLabel} missing from CSV`,
      message:
        `Your file starts ${csvStartLabel}, so MTD totals exclude ${missingDateLabel}. ` +
        `Re-download This Month from Meta Ads Manager (${intendedMtdLabel}).`,
      missingDateLabel,
      csvStartLabel,
      intendedMtdLabel,
      weeklyRangeLabel,
      suggestedDownload: "this_month",
    });
  }

  const yesterday = computeEffectiveYesterday(rows, now);
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
