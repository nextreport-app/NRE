/**
 * NRE v1 — Pillar 5: pre-generation validation.
 * "Before creating a single slide, validate the uploaded CSV... show clear
 * error messages if validation fails — never generate a broken report
 * silently." (claude_code_webapp_prompt.md)
 *
 * This has no direct Apps Script equivalent (the original just let a broken
 * upload throw mid-generation) — it's new, spec-driven guardrail logic that
 * runs before buildReportData() is ever called.
 */

import type { ColumnMap, NreRow } from "./columns";
import { getRowDate, hasRealRowDate } from "./columns";
import { parseDate } from "./dates";

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /**
   * True whenever the NO_DATA_ROWS_MESSAGE error above was the reason this
   * CSV failed validation — as opposed to a genuinely malformed file
   * (missing columns, bad date range, etc.). Lets callers (the analyze/
   * preview/generate routes) offer a Previous Month Summary report instead
   * of the hard error, when the client has Previous Month Data on file —
   * see report-upload-wizard.tsx's PreviousMonthSummaryOption. Never true
   * alongside `valid: true` — this is strictly a reason-for-failure flag,
   * not an independent "campaigns look empty" heuristic (a valid CSV with
   * real rows but $0 spend everywhere is deliberately NOT flagged here; see
   * the "Campaigns Paused" cover-slide feature, which already handles that
   * case on its own terms further downstream in report-data.ts).
   */
  noCampaignData: boolean;
}

const MAX_RANGE_DAYS = 90;
const FUTURE_GRACE_DAYS = 1; // small allowance for timezone edge effects at the CSV's export boundary

/**
 * Shown whenever the CSV has no usable data rows at all — either the file
 * is genuinely empty below the header, or every row is missing a campaign
 * name/date (see the two "rows"-field pushes below). Structured as a
 * paragraph, a bulleted list of likely causes, then a numbered action list
 * — the wizard renders this one specially (an amber warning box, not the
 * generic red error list) because "here's what probably happened and what
 * to do about it" is a real, actionable step for the user, not just a
 * malformed-file error.
 */
export const NO_DATA_ROWS_MESSAGE =
  "Your CSV contains no campaign data. This usually happens when:\n\n" +
  "• Campaigns had zero delivery during the selected date range\n" +
  "• The wrong date range was selected when downloading\n" +
  "• Campaigns were not active during this period\n\n" +
  "What to do:\n\n" +
  "1. Check Meta Ads Manager to confirm your campaigns were active during this period\n" +
  "2. Try downloading the CSV again with the correct date range\n" +
  "3. If campaigns were truly inactive for the entire period, no report can be generated as there is no data to show";

/**
 * `headers` is the raw, as-parsed header row (from parseCsvText). It isn't
 * used for any pass/fail decision — only to build a diagnostic message when
 * column detection fails, since "no Campaign name column found" is useless
 * for self-diagnosis if the actual parsed headers never surface anywhere.
 * A single garbled/glued-together header (wrong delimiter, a title row
 * mistaken for the header row, an encoding issue) fails EVERY structural
 * check at once — this makes that failure mode visible immediately instead
 * of requiring a round trip to ask "what did the server actually see?".
 */
export function validateMtdDailyCsv(
  colMap: ColumnMap,
  rows: NreRow[],
  now: Date = new Date(),
  headers: string[] = [],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!colMap.campaign_name) {
    errors.push({
      field: "campaign_name",
      message:
        "Your CSV is missing the Campaign Name column which is required. Please ensure Campaign Name is included in your download.",
    });
  }
  if (!colMap.spend) {
    errors.push({
      field: "spend",
      message:
        "Your CSV is missing the Amount Spent column. Please add Amount Spent to your column selection in Meta Ads Manager and re-download.",
    });
  }
  const hasDateColumn =
    !!colMap.date_start ||
    !!colMap.date_end ||
    rows.some((r) => !!getRowDate(r));
  if (!hasDateColumn) {
    errors.push({
      field: "date",
      message: 'No date column found (expected a "Day", "Date", or "Reporting starts/ends" column).',
    });
  } else if (!rows.some(hasRealRowDate)) {
    // A date column exists (colMap.date_start/date_end matched "Reporting
    // starts"/"Reporting ends"), but no row has a real per-row "Day"/"Date"
    // value — every row would fall back to the SAME file-wide start date
    // (see columns.ts's getRowDate), which is what a weekly- or monthly-
    // granularity Meta export looks like, not a daily one. Caught here,
    // before it ever reaches the weekly/MTD splitting logic downstream,
    // which would otherwise silently produce a garbage or empty report.
    errors.push({
      field: "date_granularity",
      message:
        "Your CSV appears to use weekly or monthly totals instead of daily data. Please re-download from Meta Ads Manager with the Time Increment set to Day before uploading.",
    });
  }
  if (!colMap.results) {
    errors.push({
      field: "results",
      message:
        "Your CSV is missing the Result Type column. Without it NextReport cannot detect your campaign objective. Please add Result Type and Results to your columns and re-download. See our Download Guide for the recommended column list.",
    });
  }

  // All four structural checks failing together almost always means the
  // header row itself wasn't split into columns correctly (wrong delimiter
  // auto-detected, a title/summary line above the real header row, a stray
  // encoding artifact) rather than genuinely missing columns — surface what
  // was actually parsed so that's diagnosable without guessing.
  if (errors.length === 4) {
    const preview = headers.length
      ? headers.map((h) => JSON.stringify(h)).join(", ")
      : "(none — the header row did not parse into any columns)";
    errors.push({
      field: "diagnostic",
      message: `Detected ${headers.length} column header(s): ${preview}. If this doesn't match your file's actual columns, the CSV likely isn't being split into columns correctly (check the delimiter, or whether a title/summary row precedes the real header row).`,
    });
  }

  if (rows.length === 0) {
    errors.push({ field: "rows", message: NO_DATA_ROWS_MESSAGE });
    return { valid: false, errors, warnings, noCampaignData: true };
  }

  // A row is usable once it has a campaign name and a resolvable date — that
  // alone is enough to place it on the right slide, in the right week. Every
  // metric column (spend, results, reach, ...) is deliberately NOT required
  // to be non-empty here: a campaign that's paused, just launched, or spent
  // $0 in the selected period legitimately has blank/zero metrics for every
  // row, and the engine already renders that correctly (zero-value metric
  // cards, the "Campaigns Paused" cover/summary text) — this validator's
  // only job is to reject a CSV it genuinely can't place on a slide at all.
  const nonEmptyCampaignRows = rows.filter((r) => (r.campaign_name || "").trim() !== "");
  if (nonEmptyCampaignRows.length === 0) {
    errors.push({ field: "campaign_name", message: "Every row has an empty campaign name." });
  }

  const usableRows = nonEmptyCampaignRows.filter((r) => !!getRowDate(r));
  const noUsableDatedRows = nonEmptyCampaignRows.length > 0 && usableRows.length === 0;
  if (noUsableDatedRows) {
    errors.push({ field: "rows", message: NO_DATA_ROWS_MESSAGE });
  }

  // Date range sanity — skip if we already know there's no usable date column.
  if (hasDateColumn) {
    let minTs: number | null = null;
    let maxTs: number | null = null;
    rows.forEach((row) => {
      const d = parseDate(getRowDate(row));
      if (!d) return;
      const ts = Date.UTC(d.year, d.month - 1, d.day);
      if (minTs === null || ts < minTs) minTs = ts;
      if (maxTs === null || ts > maxTs) maxTs = ts;
    });

    if (minTs === null || maxTs === null) {
      errors.push({ field: "date", message: "Could not parse any dates in the date column." });
    } else {
      const todayTs = new Date(now.toISOString().split("T")[0] + "T00:00:00Z").getTime();
      const futureLimitTs = todayTs + FUTURE_GRACE_DAYS * 24 * 60 * 60 * 1000;
      if (maxTs > futureLimitTs) {
        errors.push({
          field: "date",
          message: "The CSV contains dates in the future. Re-export the report for the correct date range.",
        });
      }
      const spanDays = (maxTs - minTs) / (24 * 60 * 60 * 1000);
      if (spanDays > MAX_RANGE_DAYS) {
        errors.push({
          field: "date",
          message: `The date range spans ${Math.round(spanDays)} days — upload a single month's daily export (max ${MAX_RANGE_DAYS} days).`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, noCampaignData: noUsableDatedRows };
}
