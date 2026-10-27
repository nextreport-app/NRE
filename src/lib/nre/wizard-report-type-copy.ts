/**
 * Single source for wizard report-type names, card copy, and default deck titles.
 */

import type { ReportTypeValue } from "@/components/report-upload-wizard/types";

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

export const WIZARD_REPORT_TYPE_COPY: Record<ReportTypeValue, WizardReportTypeCopy> = {
  WEEKLY: {
    pickerLabel: "Weekly report",
    cardHeading: "Weekly report",
    cardOneLiner: "Week + MTD totals + last-30-day chart.",
    cardYouGet: "Default: last 7 days ending yesterday, month-to-date totals and a last-30-day chart. Previous-month totals appear when the separate CSV is included.",
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
    pickerLabel: "Compare two periods",
    cardHeading: "Compare two periods",
    cardOneLiner: "Compare the same campaigns across two date ranges.",
    cardYouGet: "Choose Period A and Period B to compare campaign metrics side by side, with a summary table.",
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
  QUARTER: {
    pickerLabel: "Quarterly Performance Report",
    cardHeading: "Quarterly Performance Report",
    cardOneLiner: "Calendar quarter to date.",
    cardYouGet: "Quarter-to-date campaign performance and chart for the current quarter.",
    defaultDeckTitle: "Quarterly Performance Report",
  },
  YTD: {
    pickerLabel: "Year-to-Date Performance Report",
    cardHeading: "Year-to-Date Performance Report",
    cardOneLiner: "Jan 1 through yesterday.",
    cardYouGet: "Year-to-date totals and chart from January 1 through yesterday.",
    defaultDeckTitle: "Year-to-Date Performance Report",
  },
  CREATIVE: {
    pickerLabel: "Creative Performance Report",
    cardHeading: "Creative Performance Report",
    cardOneLiner: "Ad-level creative rows.",
    cardYouGet: "Creative-level CSV (ad name / ad ID rows) with spend and results per ad.",
    defaultDeckTitle: "Creative Performance Report",
  },
};

export function wizardReportTypeCopy(reportType: ReportTypeValue): WizardReportTypeCopy | null {
  if (reportType in WIZARD_REPORT_TYPE_COPY) {
    return WIZARD_REPORT_TYPE_COPY[reportType as ReportTypeValue];
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
