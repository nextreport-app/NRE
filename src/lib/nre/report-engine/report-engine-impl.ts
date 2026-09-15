import type { Platform } from "../google-columns";
import {
  buildComparisonReportData,
  buildPreviousMonthSummaryReportData,
  buildReportData,
  type BuildComparisonReportDataInput,
  type BuildPreviousMonthSummaryReportDataInput,
  type BuildReportDataInput,
} from "../report-data";
import { buildHistoricalReportData, type BuildHistoricalReportDataInput } from "../historical-report-data";
import type { ReportEngine } from "./types";

class ReportEngineImpl implements ReportEngine {
  readonly platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  buildStandard(input: BuildReportDataInput) {
    return buildReportData({ ...input, platform: input.platform ?? this.platform });
  }

  buildComparison(input: BuildComparisonReportDataInput) {
    return buildComparisonReportData({ ...input, platform: input.platform ?? this.platform });
  }

  buildPreviousMonthSummary(input: BuildPreviousMonthSummaryReportDataInput) {
    return buildPreviousMonthSummaryReportData({ ...input, platform: input.platform ?? this.platform });
  }

  buildHistorical(input: BuildHistoricalReportDataInput) {
    return buildHistoricalReportData({ ...input, platform: input.platform ?? this.platform });
  }
}

export function createReportEngine(platform: Platform): ReportEngine {
  return new ReportEngineImpl(platform);
}
