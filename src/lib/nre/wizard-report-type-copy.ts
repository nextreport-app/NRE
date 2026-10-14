/**
 * Single source for wizard report-type names, card copy, and default deck titles.
 */

import type { ReportTypeValue } from "@/components/report-upload-wizard/types";
import type { LaunchEnabledReportType } from "@/lib/meta-launch-scope";

export interface WizardReportTypeCopy {
  /** Short name in pickers (“More report types · …”). */
  pickerLabel: string;
  cardHeading: string;
  /** Shortest line on the report-type card. */
  cardOneLiner: string;
  /** Full “what you get” (hover / i tooltip). */
  cardYouGet: string;
  defaultDeckTitle: string;
}

export const WIZARD_REPORT_TYPE_COPY: Record<LaunchEnabledReportType, WizardReportTypeCopy> = {
  WEEKLY: {
    pickerLabel: "Weekly Performance Report",
    cardHeading: "Weekly Performance Report",
    cardOneLiner: "Last 7-day report.",
    cardYouGet: "Last week (7-days), MTD (month till date), last 30-day chart, optional previous month row.",
    defaultDeckTitle: "Weekly Performance Report",
  },
  MONTHLY: {
    pickerLabel: "Monthly Performance Report",
    cardHeading: "Monthly Performance Report",
    cardOneLiner: "Month-to-date report.",
    cardYouGet: "Month-to-date campaign slides and chart — one combined total row (no last-week slide).",
    defaultDeckTitle: "Monthly Performance Report",
  },
  DAILY: {
    pickerLabel: "Yesterday Performance Report",
    cardHeading: "Yesterday Performance Report",
    cardOneLiner: "Yesterday only.",
    cardYouGet: "Full campaign deck for a single day only (yesterday) — not a day-by-day table.",
    defaultDeckTitle: "Yesterday Performance Report",
  },
  COMPARISON: {
    pickerLabel: "Comparison Report",
    cardHeading: "Comparison Report",
    cardOneLiner: "Period A vs B.",
    cardYouGet: "Period A vs Period B per campaign + summary table.",
    defaultDeckTitle: "Comparison Performance Report",
  },
  HISTORICAL: {
    pickerLabel: "Multi-Month Historical Report",
    cardHeading: "Multi-Month Historical Report",
    cardOneLiner: "Multi-month history.",
    cardYouGet: "Past months: campaigns per month, month totals, then a multi-month overview table.",
    defaultDeckTitle: "Multi-Month Performance Report",
  },
  DAY_BREAKDOWN: {
    pickerLabel: "Day-by-Day Table Report",
    cardHeading: "Day-by-Day Table Report",
    cardOneLiner: "One row per day.",
    cardYouGet: "Account totals only - one row per day in a table.",
    defaultDeckTitle: "Day-by-Day Table Report",
  },
};

export function wizardReportTypeCopy(reportType: ReportTypeValue): WizardReportTypeCopy | null {
  if (reportType in WIZARD_REPORT_TYPE_COPY) {
    return WIZARD_REPORT_TYPE_COPY[reportType as LaunchEnabledReportType];
  }
  return null;
}

export function wizardReportTypePickerLabel(reportType: ReportTypeValue): string {
  return wizardReportTypeCopy(reportType)?.pickerLabel ?? "Report";
}

export function defaultDeckTitleForReportType(reportType: ReportTypeValue): string {
  const copy = wizardReportTypeCopy(reportType);
  if (copy) return copy.defaultDeckTitle;
  if (reportType === "QUARTER") return "Quarterly Performance Report";
  if (reportType === "YTD") return "Year-to-Date Performance Report";
  if (reportType === "CREATIVE") return "Creative Performance Report";
  return WIZARD_REPORT_TYPE_COPY.WEEKLY.defaultDeckTitle;
}
