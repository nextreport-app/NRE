/**
 * Import-step download instructions — per report type and client calendar day.
 */

import type { Platform } from "./google-columns";
import { getMetaCsvDownloadTip } from "./csv-date-guidance";
import type { ReportTypeValue } from "@/components/report-upload-wizard/types";
import { getPlatformLabel } from "./platform-labels";
import { getWizardCalendarContext } from "./wizard-calendar-context";
import { wizardReportTypeCopy } from "./wizard-report-type-copy";

export interface WizardExportGuidance {
  context: string;
  lines: string[];
}

function withPlatform(reportKind: string, platform: Platform): string {
  return `${reportKind} · ${getPlatformLabel(platform)}`;
}

/** Weekly Meta copy — fixed product wording (do not rephrase without product sign-off). */
function metaWeeklyExportLines(now: Date, timezone: string): string[] {
  return [
    getMetaCsvDownloadTip(now, timezone),
    "Weekly slides use the last 7-day period; the same file powers MTD, the last-30 chart, and pacing.",
  ];
}

function metaExportLines(reportType: ReportTypeValue, now: Date, timezone: string): string[] {
  const cal = getWizardCalendarContext(now, timezone);

  switch (reportType) {
    case "WEEKLY":
      return metaWeeklyExportLines(now, timezone);

    case "MONTHLY":
    case "QUARTER":
    case "YTD":
      if (cal.isFirstDayOfMonth) {
        return [
          "Today is the 1st in your client timezone — there is no month-to-date yet.",
          "Export Previous Month with Day breakdown for the full month you are closing.",
          "Do not use a “this month so far” range on the 1st; the deck expects last month’s daily rows.",
        ];
      }
      if (cal.isSecondDayOfMonth) {
        return [
          "Export from the 1st of this month through yesterday, with Day breakdown.",
          "Month-to-date is only one day so far — that is normal on the 2nd.",
          "Last 30 Days is OK only if the file still starts on the 1st of this month.",
        ];
      }
      if (cal.isLastDayOfMonth) {
        return [
          "Export from the 1st of this month through yesterday, with Day breakdown.",
          "Today is the last calendar day — ‘through yesterday’ is correct; for a fully closed month, use Previous Month on the 1st.",
          "Last 30 Days is OK only if the file still starts on the 1st of this month.",
        ];
      }
      return [
        "Export from the 1st of this month through yesterday, with Day breakdown.",
        "Last 30 Days is OK only if the file still starts on the 1st of this month.",
      ];

    case "DAILY":
      if (cal.isFirstDayOfMonth) {
        return [
          "Export with Day breakdown and include yesterday (that is the last day of the previous month).",
          "Last 7 Days is enough — you do not need Last 30 Days for this report.",
        ];
      }
      return [
        "Export with Day breakdown and include yesterday (Last 7 Days is enough).",
        "This deck is for one day only — not a multi-day table report.",
      ];

    case "DAY_BREAKDOWN":
      return [
        "Export every day you want as a table row, with Day breakdown.",
        "Match Ads Manager to the date range you will pick after upload.",
        cal.isFirstDayOfMonth
          ? "On the 1st, your range may start in the previous month — that is fine if those days are in the file."
          : "Last 30 Days works only if every day you need is inside that window.",
      ];

    case "COMPARISON":
      if (cal.isFirstDayOfMonth) {
        return [
          "One CSV must cover both periods you will compare, with Day breakdown.",
          "On the 1st, Period A or B may fall in the previous month — use a custom range wide enough for both.",
        ];
      }
      return [
        "One CSV must cover both periods you will compare, with Day breakdown.",
        "Last 30 Days works only if both periods fit inside it; otherwise pick a wider custom range.",
      ];

    case "HISTORICAL":
      return [
        "Export every complete month you want in the deck, with Day breakdown.",
        "Use one continuous custom range in Ads Manager — add earlier months until nothing is missing.",
        cal.isFirstDayOfMonth
          ? "On the 1st, the latest full month is usually the one that just ended (Previous Month export)."
          : undefined,
      ].filter((line): line is string => Boolean(line));

    case "CREATIVE":
      return [
        "Ads tab → export with Day breakdown and an Ad name column.",
        cal.isFirstDayOfMonth
          ? "Date range: Previous Month or Last 30 Days."
          : "Date range: Last 30 Days (or enough days for your creative window).",
      ];

    default:
      return metaWeeklyExportLines(now, timezone);
  }
}

function googleExportLines(reportType: ReportTypeValue, cal: ReturnType<typeof getWizardCalendarContext>): string[] {
  const base = ["Segment: Day · campaign export with cost and conversions."];
  switch (reportType) {
    case "WEEKLY":
      base.push("About 30 days of data.");
      break;
    case "MONTHLY":
    case "QUARTER":
    case "YTD":
      if (cal.isFirstDayOfMonth) {
        base.push("On the 1st: export the previous full calendar month (no MTD yet).");
      } else {
        base.push("From the 1st of this month through yesterday.");
      }
      break;
    case "DAILY":
      base.push("Include yesterday (about 7 days is enough).");
      break;
    default:
      base.push("Cover every date you will select in the wizard.");
  }
  return base;
}

export function wizardExportGuidanceForReportType(input: {
  reportType: ReportTypeValue;
  platform: Platform;
  clientTimezone: string;
  now?: Date;
}): WizardExportGuidance {
  const { reportType, platform, clientTimezone } = input;
  const now = input.now ?? new Date();
  const cal = getWizardCalendarContext(now, clientTimezone);
  const typeCopy = wizardReportTypeCopy(reportType);
  const kind = typeCopy?.pickerLabel ?? "Campaign report";

  if (platform === "META") {
    return {
      context: withPlatform(kind, platform),
      lines: metaExportLines(reportType, now, clientTimezone),
    };
  }

  if (platform === "GOOGLE") {
    return { context: withPlatform(kind, platform), lines: googleExportLines(reportType, cal) };
  }

  if (platform === "TIKTOK") {
    const lines = ["Day-level campaign export with spend and results."];
    if (reportType === "WEEKLY") lines.push("About 30 days of data.");
    else if (reportType === "DAILY") lines.push("Include yesterday (about 7 days is enough).");
    else if (reportType === "MONTHLY" || reportType === "QUARTER" || reportType === "YTD") {
      lines.push(
        cal.isFirstDayOfMonth
          ? "On the 1st: previous full calendar month."
          : "From the 1st of this month through yesterday.",
      );
    } else lines.push("Cover every date you will select in the wizard.");
    return { context: withPlatform(kind, platform), lines };
  }

  return {
    context: "Export before upload",
    lines: ["Use a day-level export that matches your report period."],
  };
}
