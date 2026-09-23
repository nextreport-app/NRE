/**
 * ReportEngine — platform-aware facade over NRE data builders.
 */

import type { Platform } from "../google-columns";
import type {
  BuildReportDataInput,
  BuildComparisonReportDataInput,
  BuildPreviousMonthSummaryReportDataInput,
  ComparisonReportData,
  ReportData,
} from "../report-data";
import type { BuildHistoricalReportDataInput, HistoricalReportData } from "../historical-report-data";
import type { BuildDayBreakdownReportDataInput, DayBreakdownReportData } from "../day-breakdown-report-data";

export interface ReportEngine {
  readonly platform: Platform;

  buildStandard(input: BuildReportDataInput): ReportData;
  buildComparison(input: BuildComparisonReportDataInput): ComparisonReportData;
  buildPreviousMonthSummary(input: BuildPreviousMonthSummaryReportDataInput): ReportData;
  buildHistorical(input: BuildHistoricalReportDataInput): HistoricalReportData;
  buildDayBreakdown(input: BuildDayBreakdownReportDataInput): DayBreakdownReportData;
}

export type { BuildReportDataInput, BuildComparisonReportDataInput, BuildPreviousMonthSummaryReportDataInput };
export type { ComparisonReportData, ReportData, HistoricalReportData, DayBreakdownReportData };
