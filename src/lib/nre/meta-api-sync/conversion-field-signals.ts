import type { MetaInsightResultMetric, MetaInsightRow } from "@/lib/meta-api";
import { isWebsiteSubmissionResultAction } from "./website-submission-actions";

function metricValue(entry: { values?: Array<{ value?: string }>; value?: string }): number {
  const nested = entry.values?.[0]?.value;
  if (nested != null && nested !== "") {
    const n = parseFloat(nested);
    if (Number.isFinite(n)) return n;
  }
  const direct = entry.value;
  if (direct != null && direct !== "") {
    const n = parseFloat(direct);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function parseIndicator(indicator: string): string | null {
  const trimmed = indicator.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("actions:")) return trimmed.slice("actions:".length);
  if (trimmed.includes(".")) return trimmed;
  if (/^[a-z][a-z0-9_]*$/i.test(trimmed)) return trimmed;
  return null;
}

function costForIndicatorOnList(
  entries: MetaInsightRow["cost_per_result"] | undefined,
  indicator: string,
): number {
  const want = indicator.trim();
  const wantAction = parseIndicator(want);
  for (const entry of entries ?? []) {
    const ind = (entry.indicator ?? "").trim();
    if (ind !== want && !(wantAction && parseIndicator(ind) === wantAction)) continue;
    const n = metricValue(entry);
    if (n > 0) return n;
  }
  return 0;
}

function costedFrom(
  resultMetrics: MetaInsightResultMetric[] | undefined,
  costMetrics: MetaInsightResultMetric[] | undefined,
): number {
  let n = 0;
  for (const entry of resultMetrics ?? []) {
    const indicator = entry.indicator ?? "";
    const actionType = parseIndicator(indicator);
    if (!actionType) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(costMetrics, indicator);
    if (cost <= 0) continue;
    n++;
  }
  return n;
}

/** Rows with paired results + cost_per_result (or objective), not daily uncosted actions:lead noise. */
export function hasMeaningfulConversionFields(row: MetaInsightRow): boolean {
  const costedResults = costedFrom(row.results, row.cost_per_result);
  if (costedResults > 0) return true;
  const costedObjective = costedFrom(row.objective_results, row.cost_per_objective_result);
  return costedObjective > 0;
}

export function countRowsWithMeaningfulConversionFields(rows: MetaInsightRow[]): number {
  return rows.filter((r) => hasMeaningfulConversionFields(r)).length;
}

/** Costed results[] pairs that Ads Manager would show as website submission / lead. */
export function hasMeaningfulWebsiteConversionFields(row: MetaInsightRow): boolean {
  for (const entry of row.results ?? []) {
    const actionType = parseIndicator(entry.indicator ?? "");
    if (!actionType || !isWebsiteSubmissionResultAction(actionType)) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(row.cost_per_result, entry.indicator ?? "");
    if (cost > 0) return true;
  }
  for (const entry of row.objective_results ?? []) {
    const actionType = parseIndicator(entry.indicator ?? "");
    if (!actionType || !isWebsiteSubmissionResultAction(actionType)) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(row.cost_per_objective_result, entry.indicator ?? "");
    if (cost > 0) return true;
  }
  return false;
}

export function countRowsWithCostedWebsiteOrLeadInResults(rows: MetaInsightRow[]): number {
  return rows.filter((r) => hasMeaningfulWebsiteConversionFields(r)).length;
}

const CUSTOM_CONVERSION = /offsite_conversion\.custom\./i;

/** Costed website rows Ads Manager ad-set export trusts (excludes generic actions:lead noise). */
export function hasCostedAdsetWebsiteResult(row: MetaInsightRow): boolean {
  for (const entry of row.results ?? []) {
    const actionType = parseIndicator(entry.indicator ?? "");
    if (!actionType || actionType === "lead") continue;
    if (
      !CUSTOM_CONVERSION.test(actionType) &&
      actionType !== "offsite_conversion.fb_pixel_lead" &&
      actionType !== "onsite_web_lead" &&
      actionType !== "website_lead"
    ) {
      continue;
    }
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(row.cost_per_result, entry.indicator ?? "");
    if (cost > 0) return true;
  }
  return false;
}

export function countRowsWithCostedAdsetWebsiteResult(rows: MetaInsightRow[]): number {
  return rows.filter((r) => hasCostedAdsetWebsiteResult(r)).length;
}

/** First costed result indicators on a row (for live API diagnostics). */
export function sampleCostedResultIndicators(row: MetaInsightRow, limit = 4): string[] {
  const out: string[] = [];
  for (const entry of row.results ?? []) {
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(row.cost_per_result, entry.indicator ?? "");
    if (cost <= 0) continue;
    out.push((entry.indicator ?? "").trim() || "?");
    if (out.length >= limit) break;
  }
  return out;
}
