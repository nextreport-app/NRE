/**
 * User-facing export instructions for Import step help — tied to report type and platform.
 */

import type { Platform } from "./google-columns";
import { getMetaCsvDownloadTip } from "./csv-date-guidance";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";

export interface WizardExportGuidance {
  title: string;
  lines: string[];
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
    const baseTip = getMetaCsvDownloadTip(now, clientTimezone);
    switch (reportType) {
      case "WEEKLY":
        return {
          title: "Ads Manager export (weekly report)",
          lines: [
            baseTip,
            "Weekly slides use the last 7-day period; the same file powers MTD, the last-30 chart, and pacing.",
          ],
        };
      case "MONTHLY":
      case "QUARTER":
      case "YTD":
        return {
          title: "Ads Manager export (monthly-style report)",
          lines: [baseTip, "Day breakdown; through yesterday for MTD and the performance chart."],
        };
      case "DAILY":
        return {
          title: "Ads Manager export (daily report)",
          lines: [baseTip, "Include yesterday plus a few prior days (Day breakdown)."],
        };
      case "DAY_BREAKDOWN":
        return {
          title: "Ads Manager export (day table)",
          lines: [
            "Cover every day you want in the table — Last 30 days + Day breakdown is a safe default.",
          ],
        };
      case "COMPARISON":
        return {
          title: "One CSV for both periods",
          lines: [
            baseTip,
            "Day breakdown; after upload you pick Period A and B inside this file.",
          ],
        };
      case "HISTORICAL":
        return {
          title: "Ads Manager export (multi-month)",
          lines: ["Day breakdown across every month you want in the deck."],
        };
      case "CREATIVE":
        return {
          title: "Ads Manager export (creative report)",
          lines: [
            "Ads tab → day breakdown with Ad name.",
            "Same date idea as campaigns: Last 30 days (or Previous month on the 1st).",
          ],
        };
      default:
        return {
          title: "Ads Manager export",
          lines: [baseTip, "Day breakdown."],
        };
    }
  }

  if (platform === "GOOGLE") {
    return {
      title: "Google Ads export",
      lines: [
        "Day-level report with campaigns, cost, and primary conversions.",
        reportType === "WEEKLY"
          ? "Include ~30 days for weekly slides and charts."
          : "Cover the full period in the deck.",
      ],
    };
  }

  if (platform === "TIKTOK") {
    return {
      title: "TikTok Ads export",
      lines: [
        "Day-level campaign export with spend and results.",
        ...(reportType === "WEEKLY" ? ["Include ~30 days of daily rows for weekly + chart slides."] : []),
      ],
    };
  }

  return {
    title: "Export before upload",
    lines: ["Use a day-level export that matches your report period."],
  };
}
