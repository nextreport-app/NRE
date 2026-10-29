/**
 * What CSV export users need per wizard report type — date span + breakdown.
 * Daily observations support arbitrary periods; monthly reports also accept validated campaign/month interval totals.
 */

import type { ReportTypeValue } from "@/components/report-upload-wizard/types";
import { getWizardCalendarContext } from "./wizard-calendar-context";

export type WizardCsvRequirement = {
  /** One line for cards and import banner, e.g. "Last 30 days · Day-wise CSV". */
  shortNote: string;
  /** Extra sentence for tooltip / import helper. */
  detail: string;
  /** Whether the chosen report needs individual daily observations. */
  dayWiseRequired: boolean;
};

const DAY_WISE = "Day-wise breakdown is required (not month-only totals).";

export function wizardCsvRequirementForReportType(input: {
  reportType: ReportTypeValue;
  clientTimezone: string;
  now?: Date;
}): WizardCsvRequirement {
  const now = input.now ?? new Date();
  const cal = getWizardCalendarContext(now, input.clientTimezone);
  const { reportType } = input;

  switch (reportType) {
    case "WEEKLY":
      return {
        shortNote: "Last 30 days · Day-wise CSV",
        detail: `One export covers last week, MTD, and the last-30 chart. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "MONTHLY":
      return { shortNote: "Day rows or campaign/month totals", detail: "For one month use campaign totals; for several months use Month or Day breakdown. Totals need Reporting starts/ends and one row per campaign/month; a combined multi-month total cannot be split.", dayWiseRequired: false };

    case "QUARTER":
    case "YTD":
      if (cal.isFirstDayOfMonth) {
        return {
          shortNote: "Previous full month · Day-wise CSV",
          detail: `On the 1st there is no MTD yet — export the month you are closing. ${DAY_WISE}`,
          dayWiseRequired: true,
        };
      }
      return {
        shortNote: "1st of month → yesterday · Day-wise CSV",
        detail: `Month-to-date daily rows (Last 30 days works if it still starts on the 1st). ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "DAILY":
      return {
        shortNote: "Selected day · Day-wise CSV",
        detail: `Only the selected day is used; yesterday is the default. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "COMPARISON":
      return {
        shortNote: "One CSV for both periods · Day-wise",
        detail: `Last 30 days is fine when Period A and B both fit inside it; otherwise use a wider custom range. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "DAY_BREAKDOWN":
      return {
        shortNote: "Your table date range · Day-wise CSV",
        detail: `Export every day you will select after upload (often Last 30 days if that covers your range). ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "HISTORICAL":
      return {
        shortNote: "Multi-month range · Month or Day breakdown",
        detail: "Export all selected months using Month or Day breakdown, not a single Last 30 days file. Monthly totals must be campaign-level with Reporting starts/ends.",
        dayWiseRequired: false,
      };

    case "CREATIVE":
      return {
        shortNote: "Ad-level · Day-wise CSV",
        detail: `Ads tab export with Ad name column; Last 30 days or Previous Month depending on timing. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    default:
      return {
        shortNote: "Last 30 days · Day-wise CSV",
        detail: DAY_WISE,
        dayWiseRequired: true,
      };
  }
}
