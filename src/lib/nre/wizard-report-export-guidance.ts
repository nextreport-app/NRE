/**
 * User-facing export instructions before CSV upload — ties report type to Ads Manager date range.
 */

import type { Platform } from "./google-columns";
import { getMetaCsvDownloadTip } from "./csv-date-guidance";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";

export interface WizardExportGuidance {
  headline: string;
  bullets: string[];
  /** Short line under the upload zone */
  footnote?: string;
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
          headline: "Before you upload — export this from Ads Manager",
          bullets: [
            baseTip,
            "Weekly slides use the last 7-day period; the same file also powers month-to-date, the last-30-days chart, and pacing.",
          ],
          footnote: "Last 7 days only is not enough — we need ~30 days of daily rows even for a weekly deck.",
        };
      case "MONTHLY":
      case "QUARTER":
      case "YTD":
        return {
          headline: "Before you upload — export this from Ads Manager",
          bullets: [
            baseTip,
            "Time breakdown: Day.",
            "The deck uses your CSV through yesterday for month-to-date and the performance chart.",
          ],
        };
      case "DAILY":
        return {
          headline: "Before you upload — export this from Ads Manager",
          bullets: [
            baseTip,
            "Time breakdown: Day — include yesterday and a few prior days so we can validate delivery.",
          ],
        };
      case "DAY_BREAKDOWN":
        return {
          headline: "Before you upload — export this from Ads Manager",
          bullets: [
            "Date range: cover every day you want in the table (Last 30 days + Day breakdown is a safe default).",
            "Time breakdown: Day.",
          ],
        };
      case "COMPARISON":
        return {
          headline: "Before you upload — one CSV must cover both periods",
          bullets: [
            baseTip,
            "Time breakdown: Day.",
            "After upload you will pick Period A and Period B — both must fall inside this file.",
          ],
        };
      case "HISTORICAL":
        return {
          headline: "Before you upload — export enough history",
          bullets: [
            "Use a range that covers every month you want in the deck (often several months with Day breakdown).",
            "Time breakdown: Day is recommended.",
          ],
        };
      case "CREATIVE":
        return {
          headline: "Before you upload — ad-level export",
          bullets: [
            "Ads Manager → Ads tab → export with Day breakdown and an Ad name column.",
            "Same date guidance as campaign exports: Last 30 days (or Previous month on the 1st).",
          ],
        };
      default:
        return {
          headline: "Before you upload",
          bullets: [baseTip, "Time breakdown: Day."],
        };
    }
  }

  if (platform === "GOOGLE") {
    return {
      headline: "Before you upload — Google Ads export",
      bullets: [
        "Use a day-level report that includes campaigns, cost, and your primary conversion columns.",
        reportType === "WEEKLY"
          ? "Include at least the last 30 days so weekly slides and charts have enough history."
          : "Cover the full period you want in the deck.",
      ],
    };
  }

  if (platform === "TIKTOK") {
    return {
      headline: "Before you upload — TikTok Ads export",
      bullets: [
        "Day-level campaign export with spend and results for the period you are reporting.",
        reportType === "WEEKLY" ? "Include ~30 days of daily rows for weekly + chart slides." : "",
      ].filter(Boolean),
    };
  }

  return {
    headline: "Before you upload",
    bullets: ["Use a day-level export that matches your report period."],
  };
}
