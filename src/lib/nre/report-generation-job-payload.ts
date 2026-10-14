import type { Platform } from "@/lib/nre/google-columns";
import type { ComparisonReportData, ReportData } from "@/lib/nre/report-data";
import type { HistoricalReportData } from "@/lib/nre/historical-report-data";
import type { DayBreakdownReportData } from "@/lib/nre/day-breakdown-report-data";

export const REPORT_GENERATION_JOB_VERSION = 1 as const;

export type ReportGenerationJobPayload =
  | StandardReportJobPayload
  | ComparisonReportJobPayload
  | HistoricalReportJobPayload
  | DayBreakdownReportJobPayload
  | PreviousMonthSummaryJobPayload;

interface BaseJobPayload {
  version: typeof REPORT_GENERATION_JOB_VERSION;
  userId: string;
  clientId: string;
  uploadSessionId?: string;
}

export interface StandardReportJobPayload extends BaseJobPayload {
  kind: "STANDARD";
  platform: Platform;
  reportTitle?: string;
  reportData: ReportData;
  /** Pre-warmed on the preview step when config unchanged — skips generateInsights. */
  aiCopyPrecalc?: Record<string, import("@/lib/pptx/fill-tags").AiCopy>;
  /** When set, stored on share JSON (Meta hybrid API + manual CSV import). */
  dataImportNote?: string;
}

export interface ComparisonReportJobPayload extends BaseJobPayload {
  kind: "COMPARISON";
  platform: Platform;
  reportTitle?: string;
  comparisonData: ComparisonReportData;
}

export interface HistoricalReportJobPayload extends BaseJobPayload {
  kind: "HISTORICAL";
  platform: Platform;
  reportTitle?: string;
  historicalData: HistoricalReportData;
  shareToken: string;
}

export interface DayBreakdownReportJobPayload extends BaseJobPayload {
  kind: "DAY_BREAKDOWN";
  platform: Platform;
  reportTitle?: string;
  dayBreakdownData: DayBreakdownReportData;
  shareToken: string;
}

export interface PreviousMonthSummaryJobPayload extends BaseJobPayload {
  kind: "PREVIOUS_MONTH_SUMMARY";
  platform: Platform;
  summaryData: ReportData;
  shareToken: string;
}

export function serializeReportGenerationJob(payload: ReportGenerationJobPayload): string {
  return JSON.stringify({ ...payload, version: REPORT_GENERATION_JOB_VERSION });
}

export function parseReportGenerationJob(raw: string | null | undefined): ReportGenerationJobPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as ReportGenerationJobPayload;
    if (parsed.version !== REPORT_GENERATION_JOB_VERSION) return null;
    if (!parsed.userId || !parsed.clientId || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}
