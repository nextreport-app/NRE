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
    pickerLabel: "Weekly overview",
    cardHeading: "Weekly overview",
    cardOneLiner: "Week + MTD totals + last-30-day chart.",
    cardYouGet: "Default: last 7 days ending yesterday, month-to-date totals and a last-30-day chart. Previous-month totals appear when the separate CSV is included.",
    defaultDeckTitle: "Weekly Performance Report",
  },
  MONTHLY: {
    pickerLabel: "Monthly report",
    cardHeading: "Monthly report",
    cardOneLiner: "One calendar month or current month to date.",
    cardYouGet: "Campaign performance, totals and chart for one selected month. No weekly slides.",
    defaultDeckTitle: "Monthly Performance Report",
  },
  DAILY: {
    pickerLabel: "Single-day report",
    cardHeading: "Single-day report",
    cardOneLiner: "Yesterday or another selected day.",
    cardYouGet: "Campaign performance, a campaign chart and totals for one selected day. No monthly performance slides.",
    defaultDeckTitle: "Single-day report",
  },
  COMPARISON: {
    pickerLabel: "Compare two periods",
    cardHeading: "Compare two periods",
    cardOneLiner: "Week vs week, month vs month, or two custom ranges.",
    cardYouGet: "Choose two weekly, monthly or custom date ranges. Campaign metrics appear side by side, followed by a summary table; no last-30-day chart.",
    defaultDeckTitle: "Comparison Performance Report",
  },
  HISTORICAL: {
    pickerLabel: "Month-by-month report",
    cardHeading: "Month-by-month report",
    cardOneLiner: "Monthly totals and campaign performance across 2–12 months.",
    cardYouGet: "Past months: campaigns per month, month totals, then a multi-month overview table.",
    defaultDeckTitle: "Multi-Month Performance Report",
  },
  DAY_BREAKDOWN: {
    pickerLabel: "Day-by-day table",
    cardHeading: "Day-by-day table",
    cardOneLiner: "One row per day.",
    cardYouGet: "Account totals across a date range, one row per day. No campaign slides, monthly totals or chart.",
    defaultDeckTitle: "Day-by-day table",
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
