/**
 * What CSV export users need per wizard report type — date span + breakdown.
 * Wizard guidance consistently requests daily observations for every report type.
 */

import type { ReportTypeValue } from "@/components/report-upload-wizard/types";
import { getWizardCalendarContext } from "./wizard-calendar-context";

export type WizardCsvRequirement = {
  /** One line for cards and import banner, e.g. "Last 30 days · One CSV for entire period (Day-wise breakdown)". */
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
        shortNote: "Last 30 days · One CSV for entire period (Day-wise breakdown)",
        detail: `One export covers the last 7 days (ending yesterday), MTD, and the last-30-day chart. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "MONTHLY":
      return { shortNote: "Selected months · One CSV for entire period (Day-wise breakdown)", detail: "Export the entire selected month range with Day-wise breakdown, including the current month through yesterday when selected.", dayWiseRequired: true };

    case "QUARTER":
    case "YTD":
      if (cal.isFirstDayOfMonth) {
        return {
          shortNote: "Previous full month · One CSV for entire period (Day-wise breakdown)",
          detail: `On the 1st there is no MTD yet — export the month you are closing. ${DAY_WISE}`,
          dayWiseRequired: true,
        };
      }
      return {
        shortNote: "1st of month → yesterday · One CSV for entire period (Day-wise breakdown)",
        detail: `Month-to-date daily rows (Last 30 days works if it still starts on the 1st). ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "DAILY":
      return {
        shortNote: "Selected day · One CSV for entire period (Day-wise breakdown)",
        detail: `Only the selected day is used; yesterday is the default. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "COMPARISON":
      return {
        shortNote: "Both selected periods · One CSV for entire period (Day-wise breakdown)",
        detail: `Last 30 days is fine when Period A and B both fit inside it; otherwise use a wider custom range. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "DAY_BREAKDOWN":
      return {
        shortNote: "Your table date range · One CSV for entire period (Day-wise breakdown)",
        detail: `Export every day you will select after upload (often Last 30 days if that covers your range). ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    case "HISTORICAL":
      return {
        shortNote: "Multi-month range · One CSV for entire period (Day-wise breakdown)",
        detail: "Export all selected months using Day-wise breakdown, not a single Last 30 days file.",
        dayWiseRequired: true,
      };

    case "CREATIVE":
      return {
        shortNote: "Ad-level · One CSV for entire period (Day-wise breakdown)",
        detail: `Ads tab export with Ad name column; Last 30 days or Previous Month depending on timing. ${DAY_WISE}`,
        dayWiseRequired: true,
      };

    default:
      return {
        shortNote: "Last 30 days · One CSV for entire period (Day-wise breakdown)",
        detail: DAY_WISE,
        dayWiseRequired: true,
      };
  }
}
