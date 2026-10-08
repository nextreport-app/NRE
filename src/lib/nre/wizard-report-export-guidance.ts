/**
 * Import-step download instructions — aligned to how each report type uses the CSV.
 */

import type { Platform } from "./google-columns";
import { getCalendarDateInTimezone } from "./dates";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";
import { getPlatformLabel } from "./platform-labels";

export interface WizardExportGuidance {
  /** One-line subtitle under “Download instructions”. */
  context: string;
  lines: string[];
}

function withPlatform(reportKind: string, platform: Platform): string {
  return `${reportKind} · ${getPlatformLabel(platform)}`;
}

function isFirstCalendarDay(now: Date, timezone: string): boolean {
  return getCalendarDateInTimezone(now, timezone).day === 1;
}

/** Meta Ads Manager — date range + time breakdown per report type (see date-range.ts / report-data.ts). */
function metaExportLines(
  reportType: ReportTypeValue,
  now: Date,
  timezone: string,
): string[] {
  const onFirst = isFirstCalendarDay(now, timezone);
  const dayBreakdown = "Time breakdown: Day (one row per campaign per day).";

  switch (reportType) {
    case "WEEKLY":
      if (onFirst) {
        return [
          "Date range: Previous Month.",
          dayBreakdown,
          "You pick the 7-day slide period later; this file also powers last month’s MTD row and chart context where applicable.",
        ];
      }
      return [
        "Date range: Last 30 Days.",
        dayBreakdown,
        "You pick the 7-day slide period later; the same file also powers MTD, the last-30-days chart, and pacing.",
      ];

    case "MONTHLY":
    case "QUARTER":
    case "YTD":
      if (onFirst) {
        return [
          "Date range: Previous Month (full calendar month you are closing).",
          dayBreakdown,
          "Monthly slides and the chart use that month’s daily rows — not a trailing Last 30 Days export.",
        ];
      }
      return [
        "Date range: from the 1st of this month through yesterday.",
        dayBreakdown,
        "In Ads Manager use a custom range for those dates, or Last 30 Days only if the export still starts on the 1st of this month.",
      ];

    case "DAILY":
      return [
        "Date range: must include yesterday (Last 7 Days is enough).",
        dayBreakdown,
        "The deck uses a single day — you do not need Last 30 Days for this report type.",
      ];

    case "DAY_BREAKDOWN":
      return [
        "Date range: every day you want as a row in the table.",
        dayBreakdown,
        "Match Ads Manager to the dates you will pick after upload (Last 30 Days only if your full range fits inside it).",
      ];

    case "COMPARISON":
      return [
        onFirst
          ? "Date range: one export covering both periods (often Previous Month plus earlier days if Period A starts before this month)."
          : "Date range: one export covering both Period A and Period B (Last 30 Days works only if both periods fall inside it).",
        dayBreakdown,
        "After upload you choose Period A and B on Generate — both must lie inside this file.",
      ];

    case "HISTORICAL":
      return [
        "Date range: every complete month you want in the deck (often several months).",
        dayBreakdown,
        "Use a continuous custom range in Ads Manager; widen until all months are included.",
      ];

    case "CREATIVE":
      return [
        "Ads tab (not Campaigns) · day-level rows with Ad name.",
        onFirst
          ? "Date range: Previous Month or Last 30 Days."
          : "Date range: Last 30 Days (or enough days to cover the creative window).",
        dayBreakdown,
      ];

    default:
      if (onFirst) {
        return ["Date range: Previous Month.", dayBreakdown];
      }
      return ["Date range: Last 30 Days.", dayBreakdown];
  }
}

export function wizardExportGuidanceForReportType(input: {
  reportType: ReportTypeValue;
  platform: Platform;
  clientTimezone: string;
  now?: Date;
}): WizardExportGuidance {
  const { reportType, platform, clientTimezone } = input;
  const now = input.now ?? new Date();

  if (platform === "META") {
    const contextByType: Partial<Record<ReportTypeValue, string>> = {
      WEEKLY: "Weekly report",
      MONTHLY: "Monthly performance report",
      QUARTER: "Quarterly report",
      YTD: "Year-to-date report",
      DAILY: "Yesterday (single-day) report",
      DAY_BREAKDOWN: "Daily performance table",
      COMPARISON: "Comparison report (one CSV for both periods)",
      HISTORICAL: "Multi-month historical report",
      CREATIVE: "Creative report",
    };
    const kind = contextByType[reportType] ?? "Campaign report";
    return {
      context: withPlatform(kind, platform),
      lines: metaExportLines(reportType, now, clientTimezone),
    };
  }

  if (platform === "GOOGLE") {
    const lines = ["Segment: Day.", "Campaign-level export with cost and primary conversions."];
    switch (reportType) {
      case "WEEKLY":
        lines.push("Date range: ~30 days so weekly slides and charts have history.");
        break;
      case "MONTHLY":
      case "QUARTER":
      case "YTD":
        lines.push("Date range: from the 1st of the report month through yesterday.");
        break;
      case "DAILY":
        lines.push("Date range: include yesterday (Last 7 days is enough).");
        break;
      case "DAY_BREAKDOWN":
      case "COMPARISON":
      case "HISTORICAL":
        lines.push("Date range: cover every day or month you will select in the wizard.");
        break;
      default:
        lines.push("Date range: cover the full period in the deck.");
    }
    return { context: withPlatform("Campaign export", platform), lines };
  }

  if (platform === "TIKTOK") {
    const lines = ["Day-level campaign export with spend and results."];
    if (reportType === "WEEKLY") {
      lines.push("Date range: ~30 days for weekly slides and charts.");
    } else if (reportType === "DAILY") {
      lines.push("Date range: include yesterday (Last 7 days is enough).");
    } else if (reportType === "MONTHLY" || reportType === "QUARTER" || reportType === "YTD") {
      lines.push("Date range: from the 1st of the report month through yesterday.");
    } else {
      lines.push("Date range: cover every day or month you will select in the wizard.");
    }
    return { context: withPlatform("Campaign export", platform), lines };
  }

  return {
    context: "Export before upload",
    lines: ["Use a day-level export that matches your report period."],
  };
}
