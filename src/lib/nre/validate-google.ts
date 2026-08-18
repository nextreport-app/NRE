/**
 * Google Ads CSV pre-generation validation — the Google Ads counterpart to
 * validate.ts's Meta validator. Same "never generate a broken report
 * silently" contract and ValidationResult/ValidationIssue shape, checked
 * against Google Ads' own required columns instead of Meta's.
 */

import type { GoogleColumnMap, GoogleRow } from "./google-columns";
import { parseDate } from "./dates";
import type { ValidationIssue, ValidationResult } from "./validate";

const MAX_RANGE_DAYS = 90;
const FUTURE_GRACE_DAYS = 1;

export const GOOGLE_NO_DATA_ROWS_MESSAGE =
  "Your CSV contains no campaign data. This usually happens when:\n\n" +
  "• Campaigns had zero delivery during the selected date range\n" +
  "• The wrong date range was selected when downloading\n" +
  "• Campaigns were not active during this period\n\n" +
  "What to do:\n\n" +
  "1. Check Google Ads to confirm your campaigns were active during this period\n" +
  "2. Try downloading the report again with the correct date range\n" +
  "3. If campaigns were truly inactive for the entire period, no report can be generated as there is no data to show";

function getGoogleRowDate(row: GoogleRow): string {
  return row.day ?? "";
}

/**
 * Required columns for Google Ads CSV: Campaign, Day (or Date or Week),
 * Cost, Clicks, Impressions, CTR, Avg. CPC — per spec. `headers` is only
 * used for the same "all structural checks failed together" diagnostic
 * validate.ts's Meta validator produces, not for any pass/fail decision.
 */
export function validateGoogleAdsCsv(
  colMap: GoogleColumnMap,
  rows: GoogleRow[],
  now: Date = new Date(),
  headers: string[] = [],
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!colMap.campaign_name) {
    errors.push({
      field: "campaign_name",
      message:
        "Your CSV is missing the Campaign column which is required. Please ensure Campaign is included in your Google Ads report. See our Download Guide for the recommended column list.",
    });
  }
  if (!colMap.cost) {
    errors.push({
      field: "cost",
      message:
        "Your CSV is missing the Cost column. Please add Cost to your column selection in Google Ads and re-download. See our Download Guide for the recommended column list.",
    });
  }
  if (!colMap.clicks) {
    errors.push({
      field: "clicks",
      message:
        "Your CSV is missing the Clicks column. Please add Clicks to your column selection in Google Ads and re-download. See our Download Guide for the recommended column list.",
    });
  }
  if (!colMap.impressions) {
    errors.push({
      field: "impressions",
      message:
        "Your CSV is missing the Impressions column. Please add Impressions to your column selection in Google Ads and re-download. See our Download Guide for the recommended column list.",
    });
  }
  if (!colMap.ctr) {
    errors.push({
      field: "ctr",
      message:
        "Your CSV is missing the CTR column. Please add CTR to your column selection in Google Ads and re-download. See our Download Guide for the recommended column list.",
    });
  }
  if (!colMap.avg_cpc) {
    errors.push({
      field: "avg_cpc",
      message:
        "Your CSV is missing the Avg. CPC column. Please add Avg. CPC to your column selection in Google Ads and re-download. See our Download Guide for the recommended column list.",
    });
  }

  const hasDateColumn = !!colMap.day || rows.some((r) => !!getGoogleRowDate(r));
  if (!hasDateColumn) {
    errors.push({
      field: "date",
      message:
        'No date column found (expected a "Day", "Date", or "Week" column). Please add a date column in Google Ads and re-download. See our Download Guide for the recommended column list.',
    });
  }

  if (errors.length === 7) {
    const preview = headers.length
      ? headers.map((h) => JSON.stringify(h)).join(", ")
      : "(none — the header row did not parse into any columns)";
    errors.push({
      field: "diagnostic",
      message: `Detected ${headers.length} column header(s): ${preview}. If this doesn't match your file's actual columns, the CSV likely isn't being split into columns correctly (check the delimiter, or whether a title/summary row precedes the real header row).`,
    });
  }

  if (rows.length === 0) {
    errors.push({ field: "rows", message: GOOGLE_NO_DATA_ROWS_MESSAGE });
    // Google Ads reports never support Previous Month Data (see route.ts's
    // own "Google Ads path" comment), so there's no alternative-report
    // option to offer here — noCampaignData is always false.
    return { valid: false, errors, warnings, noCampaignData: false };
  }

  const nonEmptyCampaignRows = rows.filter((r) => (r.campaign_name || "").trim() !== "");
  if (nonEmptyCampaignRows.length === 0) {
    errors.push({ field: "campaign_name", message: "Every row has an empty campaign name." });
  }

  const usableRows = nonEmptyCampaignRows.filter((r) => !!getGoogleRowDate(r));
  if (nonEmptyCampaignRows.length > 0 && usableRows.length === 0) {
    errors.push({ field: "rows", message: GOOGLE_NO_DATA_ROWS_MESSAGE });
  }

  if (hasDateColumn) {
    let minTs: number | null = null;
    let maxTs: number | null = null;
    rows.forEach((row) => {
      const d = parseDate(getGoogleRowDate(row));
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

  return { valid: errors.length === 0, errors, warnings, noCampaignData: false };
}
