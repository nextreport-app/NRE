import type { DateRangeIso } from "./date-range";
import type { ResultLabels } from "./objective";

/** Bump when numeric/event semantics change; old preview snapshots must not survive a release. */
export const REPORT_ENGINE_VERSION = "nre-accounting-2026-10-26-v3";
export interface ReportCalculationContext {
  engineVersion: string;
  asOf: string;
  timezone: string;
  primaryRange?: DateRangeIso;
  combinedRange: DateRangeIso;
  campaignObjectives: Record<string, ResultLabels>;
  periodObjectives: Record<string, ResultLabels>;
}
