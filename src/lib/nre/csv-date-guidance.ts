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
      "Today is the 1st. For a complete previous-month report (e.g. August 1–31), download Previous Month — not Last 30 Days — with Time Increment set to Day. " +
      "Last 30 Days is OK for weekly reports (your last 7 days will end on yesterday), but it often drops the 1st of the month from monthly totals."
    );
  }

  if (dayOfMonth <= 7) {
    return (
      `Today is the ${ordinalDay(dayOfMonth)}. Select Last 30 Days (not This Month) in Meta Ads Manager — this keeps your weekly slide at a full 7 days across the month boundary. ` +
      "Set Time Increment to Day."
    );
  }

  return (
    "Select This Month in Meta Ads Manager with Time Increment set to Day — complete month-to-date from the 1st through yesterday."
  );
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
    warnings.push({
      kind: "first_of_month",
      title: `Today is the 1st — you're closing ${reportingMonthName ?? "last month"}'s report`,
      message:
        `There is no data for the new month yet (we never include today). Your weekly slide will use ${weeklyRangeLabel ?? "the last 7 days ending yesterday"}. ` +
        `The monthly overview covers ${intendedMtdLabel}. ` +
        "For complete monthly totals starting on the 1st, download Previous Month from Meta Ads Manager — not Last 30 Days.",
      intendedMtdLabel,
      weeklyRangeLabel,
      suggestedDownload: "previous_month",
    });
  } else if (dayOfMonth <= 7) {
    warnings.push({
      kind: "early_month_last30",
      title: "Early in the month — use Last 30 Days",
      message:
        `Today is the ${ordinalDay(dayOfMonth)}. Select Last 30 Days (not This Month) when downloading so your weekly slide has a full 7 days across the month boundary. ` +
        `Your MTD overview will show ${intendedMtdLabel}.`,
      intendedMtdLabel,
      weeklyRangeLabel,
      suggestedDownload: "last_30_days",
    });
  }

  if (monthStartMissing) {
    const missingDateLabel = friendlyDate(mtdRange.startIso);
    const csvStartLabel = friendlyDate(csvBounds.minIso);
    warnings.push({
      kind: "missing_month_start",
      title: `${missingDateLabel} data is missing from your CSV`,
      message:
        `Your CSV starts on ${csvStartLabel}, so monthly totals exclude ${missingDateLabel}. ` +
        `The report will label the period as ${intendedMtdLabel}, but spend and results only include days present in the file. ` +
        (dayOfMonth === 1
          ? `Re-download using Previous Month (${intendedMtdLabel}) from Meta Ads Manager.`
          : dayOfMonth <= 7
            ? "Re-download using Last 30 Days with Time Increment set to Day, or use This Month once enough days have passed."
            : "Re-download using This Month from Meta Ads Manager so the export starts on the 1st."),
      missingDateLabel,
      csvStartLabel,
      intendedMtdLabel,
      weeklyRangeLabel,
      suggestedDownload: dayOfMonth === 1 ? "previous_month" : dayOfMonth <= 7 ? "last_30_days" : "this_month",
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
