import type { DailySummaryMetric } from "./daily-report-presentation";
import type { DynamicMetricValue } from "./dynamic-metrics";
import { findMetaMetricByKey } from "./meta-dictionary";

export function dailySummaryMetrics(
  metrics: DailySummaryMetric[],
): DynamicMetricValue[] {
  return metrics.map((metric) => {
    const definition = findMetaMetricByKey(metric.key);
    const cost = metric.key.startsWith("objective_cost:");
    return {
      ...metric,
      format: cost ? "currency" : (definition?.format ?? "number"),
      perUnitOf: cost ? "results" : definition?.perUnitOf,
    };
  });
}
