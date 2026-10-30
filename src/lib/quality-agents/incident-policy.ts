import { createHash, timingSafeEqual } from "node:crypto";
import type { CsvVerificationResult } from "@/lib/nre/csv-report-reconciliation";

export type IncidentKind = "CSV_MISMATCH" | "GENERATION_FAILURE" | "CUSTOMER_REPORTED";
export const SIGNAL_CODES = ["SPEND", "RESULTS", "COST_PER_RESULT", "CTR", "CPC", "REACH", "IMPRESSIONS", "CLICKS", "OTHER_METRIC", "GENERATION_FAILED", "CUSTOMER_REPORT"] as const;
const TYPES = new Set(["WEEKLY", "MONTHLY", "DAILY", "HISTORICAL", "COMPARISON", "DAY_BREAKDOWN", "PREVIOUS_MONTH_SUMMARY", "QUARTER", "YTD", "CREATIVE"]);
export function safeReportType(value: string): string { return TYPES.has(value) ? value : "OTHER"; }
export function safePlatform(value: string): string { return ["META", "GOOGLE", "TIKTOK", "GA4"].includes(value) ? value : "OTHER"; }
function metricCode(metric: string): typeof SIGNAL_CODES[number] {
  if (/\bctr\b|click.through/i.test(metric)) return "CTR";
  if (/\bcpc\b|cost per click/i.test(metric)) return "CPC";
  if (/cost per|\bcpr\b/i.test(metric)) return "COST_PER_RESULT";
  if (/spend|amount spent/i.test(metric)) return "SPEND";
  if (/result|lead|purchase|conversion/i.test(metric)) return "RESULTS";
  if (/impression/i.test(metric)) return "IMPRESSIONS";
  if (/reach/i.test(metric)) return "REACH";
  if (/click/i.test(metric)) return "CLICKS";
  return "OTHER_METRIC";
}
/** Coverage notices and skipped checks are not evidence of a calculation bug. */
export function mismatchSignals(result: CsvVerificationResult): string[] {
  if (result.status !== "mismatch") return [];
  return [...new Set(result.checks.filter(check => check.status === "mismatch").map(check => metricCode(check.metric)))].sort();
}
export function incidentFingerprint(input: { userId: string; contextKey: string; kind: IncidentKind; platform: string; reportType: string; signalCodes: string[] }): string {
  return createHash("sha256").update(JSON.stringify([input.userId, input.contextKey, input.kind, safePlatform(input.platform), safeReportType(input.reportType), [...input.signalCodes].sort()])).digest("hex");
}
/** Independent, read-only service credential. Never falls back to CRON_SECRET or an admin email. */
export function qualityAgentAuthorized(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
