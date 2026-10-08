/**
 * Import-step download instructions — aligned to how each report type uses the CSV.
 */

import type { Platform } from "./google-columns";
import { getMetaCsvDownloadTip } from "./csv-date-guidance";
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

/** Meta — weekly copy is fixed product wording; other types stay plain and short. */
function metaExportLines(
  reportType: ReportTypeValue,
  now: Date,
  timezone: string,
): string[] {
  const onFirst = isFirstCalendarDay(now, timezone);

  switch (reportType) {
    case "WEEKLY":
      return [
        getMetaCsvDownloadTip(now, timezone),
        "Weekly slides use the last 7-day period; the same file powers MTD, the last-30 chart, and pacing.",
      ];

    case "MONTHLY":
    case "QUARTER":
    case "YTD":
      if (onFirst) {
        return [
          "Export Previous Month with Day breakdown — the full calendar month you are closing.",
        ];
      }
      return [
        "Export from the 1st of this month through yesterday, with Day breakdown.",
        "Last 30 Days is OK only if your file still starts on the 1st of this month.",
      ];

    case "DAILY":
      return [
        "Export with Day breakdown and make sure yesterday is included (Last 7 Days is enough).",
      ];

    case "DAY_BREAKDOWN":
      return [
        "Export every day you want in the table, with Day breakdown.",
        "Use the same date range in Ads Manager that you will pick after upload.",
      ];

    case "COMPARISON":
      return [
        "One CSV must cover both periods you will compare, with Day breakdown.",
        onFirst
          ? "If a period starts before this month, use a wider custom range — not only Previous Month."
          : "Last 30 Days works if both periods fit inside it; otherwise choose a wider range.",
      ];

    case "HISTORICAL":
      return [
        "Export every month you want in the deck, with Day breakdown.",
        "Use one continuous date range in Ads Manager and widen it until all months are included.",
      ];

    case "CREATIVE":
      return [
        "Ads tab → export with Day breakdown and an Ad name column.",
        onFirst
          ? "Date range: Previous Month or Last 30 Days."
          : "Date range: Last 30 Days (or enough days for your creative window).",
      ];

    default:
      return [getMetaCsvDownloadTip(now, timezone)];
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
      DAILY: "Yesterday report",
      DAY_BREAKDOWN: "Daily performance table",
      COMPARISON: "Comparison report",
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
    const lines = ["Use a day-level (Segment: Day) campaign export with cost and conversions."];
    switch (reportType) {
      case "WEEKLY":
        lines.push("Include about 30 days of data.");
        break;
      case "MONTHLY":
      case "QUARTER":
      case "YTD":
        lines.push("Include from the 1st of the report month through yesterday.");
        break;
      case "DAILY":
        lines.push("Include yesterday (about 7 days of data is enough).");
        break;
      default:
        lines.push("Cover every date you will select in the wizard.");
    }
    return { context: withPlatform("Campaign export", platform), lines };
  }

  if (platform === "TIKTOK") {
    const lines = ["Use a day-level campaign export with spend and results."];
    if (reportType === "WEEKLY") {
      lines.push("Include about 30 days of data.");
    } else if (reportType === "DAILY") {
      lines.push("Include yesterday (about 7 days is enough).");
    } else if (reportType === "MONTHLY" || reportType === "QUARTER" || reportType === "YTD") {
      lines.push("Include from the 1st of the report month through yesterday.");
    } else {
      lines.push("Cover every date you will select in the wizard.");
    }
    return { context: withPlatform("Campaign export", platform), lines };
  }

  return {
    context: "Export before upload",
    lines: ["Use a day-level export that matches your report period."],
  };
}
