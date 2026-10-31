import { listSelectableMetrics, objectiveMetricKeys, type MetricPlatform, type SelectedMetric } from "./available-metrics";
import { aggregateDynamicMetrics } from "./dynamic-metrics";
import { formatMetricValue } from "./format";
import type { NreRow } from "./columns";
import { findMetaMetric } from "./meta-dictionary";
import { findGoogleMetric } from "./google-dictionary";
import { MAX_TOTAL_METRICS } from "./metric-pagination";

export interface ComparisonExtraMetric {
  key: string;
  label: string;
  valueA: number | null;
  valueB: number | null;
  formattedA: string;
  formattedB: string;
  percent: number | null;
}

/** Only exported, known numeric metrics with a supported aggregation policy. */
export function comparisonOptionalMetrics(headers: string[], platform: MetricPlatform) {
  const seen = new Set<string>();
  return listSelectableMetrics(headers, platform).map(metric => ({ ...metric, csvName: headers.find(header => (platform === "GOOGLE" ? findGoogleMetric(header) : findMetaMetric(header))?.key === metric.key) ?? metric.csvName })).filter(metric => {
    if (["spend", "cost", "reach", "results", "cost_per_result"].includes(metric.key) || metric.format === "text" || metric.perUnitOf === "__avg__" || seen.has(metric.key)) return false;
    seen.add(metric.key);
    return true;
  });
}

export function isComparisonCoreMetric(metric: SelectedMetric, objective: string, costLabel: string): boolean {
  const primary = objective === "REACH" ? { resultKey: "reach", costKey: "cost_per_1k_reached" } : objectiveMetricKeys(objective);
  const normalize = (text: string) => text.trim().toUpperCase().replace(/\s+/g, " ");
  return metric.key === primary.resultKey || metric.key === primary.costKey || (metric.format === "currency" && metric.perUnitOf === primary.resultKey && objective !== "REACH") || [normalize(objective), normalize(costLabel)].includes(normalize(metric.label));
}

export function buildComparisonExtraMetrics(input: { rowsA: NreRow[]; rowsB: NreRow[]; keys?: string[]; headers: string[]; platform: MetricPlatform; currencySymbol: string; objective: string; costLabel: string }): ComparisonExtraMetric[] {
  const keys = new Set((input.keys ?? []).slice(0, MAX_TOTAL_METRICS));
  return comparisonOptionalMetrics(input.headers, input.platform).filter(metric => keys.has(metric.key) && !isComparisonCoreMetric(metric, input.objective, input.costLabel)).map(metric => {
    const value = (rows: NreRow[]) => {
      // A missing observation is not evidence of zero. Preserve real exported zeros.
      const observed = rows.some(row => Object.entries(row._raw ?? {}).some(([header, cell]) => header.trim().toLowerCase() === metric.csvName.trim().toLowerCase() && /\d/.test(String(cell))));
      if (!observed) return null;
      const aggregate = aggregateDynamicMetrics(rows, [metric], input.platform === "GOOGLE" ? "google" : "meta")[metric.key];
      return Number.isFinite(aggregate) ? aggregate : null;
    };
    const valueA = value(input.rowsA), valueB = value(input.rowsB);
    const percent = valueA === null || valueB === null || valueB === 0 ? null : ((valueA - valueB) / valueB) * 100;
    return { key: metric.key, label: metric.label, valueA, valueB,
      formattedA: valueA === null ? "N/A" : formatMetricValue(valueA, metric.format, input.currencySymbol),
      formattedB: valueB === null ? "N/A" : formatMetricValue(valueB, metric.format, input.currencySymbol),
      percent: percent !== null && Number.isFinite(percent) ? percent : null,
    };
  });
}
