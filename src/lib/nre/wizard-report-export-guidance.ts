/**
 * User-facing export instructions for Import download block — tied to report type and platform.
 */

import type { Platform } from "./google-columns";
import { getMetaCsvDownloadTip } from "./csv-date-guidance";
import { getPlatformLabel } from "./platform-labels";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";

export interface WizardExportGuidance {
  /** One-line subtitle under “Download instructions”. */
  context: string;
  lines: string[];
}

function withPlatform(reportKind: string, platform: Platform): string {
  return `${reportKind} · ${getPlatformLabel(platform)}`;
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
          context: withPlatform("Weekly report", platform),
          lines: [
            baseTip,
            "Weekly slides use the last 7-day period; the same file powers MTD, the last-30 chart, and pacing.",
          ],
        };
      case "MONTHLY":
      case "QUARTER":
      case "YTD":
        return {
          context: withPlatform("Monthly-style report", platform),
          lines: [baseTip, "Day breakdown; through yesterday for MTD and the performance chart."],
        };
      case "DAILY":
        return {
          context: withPlatform("Yesterday report", platform),
          lines: [baseTip, "Include yesterday plus a few prior days (Day breakdown)."],
        };
      case "DAY_BREAKDOWN":
        return {
          context: withPlatform("Daily performance table", platform),
          lines: [
            "Cover every day you want in the table — Last 30 days + Day breakdown is a safe default.",
          ],
        };
      case "COMPARISON":
        return {
          context: withPlatform("Comparison report (one CSV for both periods)", platform),
          lines: [
            baseTip,
            "Day breakdown; after upload you pick Period A and B inside this file.",
          ],
        };
      case "HISTORICAL":
        return {
          context: withPlatform("Multi-month historical report", platform),
          lines: ["Day breakdown across every month you want in the deck."],
        };
      case "CREATIVE":
        return {
          context: withPlatform("Creative report", platform),
          lines: [
            "Ads tab → day breakdown with Ad name.",
            "Same date idea as campaigns: Last 30 days (or Previous month on the 1st).",
          ],
        };
      default:
        return {
          context: withPlatform("Campaign export", platform),
          lines: [baseTip, "Day breakdown."],
        };
    }
  }

  if (platform === "GOOGLE") {
    return {
      context: withPlatform("Campaign export", platform),
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
      context: withPlatform("Campaign export", platform),
      lines: [
        "Day-level campaign export with spend and results.",
        ...(reportType === "WEEKLY" ? ["Include ~30 days of daily rows for weekly + chart slides."] : []),
      ],
    };
  }

  return {
    context: "Export before upload",
    lines: ["Use a day-level export that matches your report period."],
  };
}
