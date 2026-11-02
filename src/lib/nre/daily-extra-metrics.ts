import { dailyMetricIsExcluded, dailyObjectiveMetricKey } from "./daily-metric-selection";
import { findMetaMetricByKey } from "./meta-dictionary";
import type { NreRow } from "./columns";
import { comparisonOptionalMetrics, isComparisonCoreMetric, paginateComparisonMetrics, buildComparisonExtraMetrics } from "./comparison-extra-metrics";
import { objectiveMetricKeys } from "./available-metrics";
import { MAX_TOTAL_METRICS } from "./metric-pagination";
import { dailyRangeLabel } from "./daily-period-selection";

export interface DailyExtraTable { metrics: { key: string; label: string }[]; rows: { date: string; values: string[] }[] }
export function dailyOptionalMetrics(headers: string[], objectives: { resultLabel: string; costLabel: string }[] = []) {
  return comparisonOptionalMetrics(headers, "META").filter(metric => !["impressions", "ctr", "cpc", "cpc_all"].includes(metric.key) && !objectives.some(objective => isComparisonCoreMetric(metric, objective.resultLabel, objective.costLabel)));
}
/** At most four metric columns and eight day rows per page. Never average daily rates. */
export function buildDailyExtraTables(byDay: Map<string, NreRow[]>, headers: string[], keys: string[] | undefined, objectives: { resultLabel: string; costLabel: string }[], currencySymbol: string): DailyExtraTable[] {
  const selected = new Set(keys ?? []);
  const metrics = dailyOptionalMetrics(headers, objectives).filter(metric => selected.has(metric.key)).slice(0, MAX_TOTAL_METRICS);
  const pages: DailyExtraTable[] = [];
  const days = [...byDay.keys()].sort();
  for (const metricPage of paginateComparisonMetrics(metrics)) {
    for (let offset = 0; offset < days.length; offset += 8) {
      const rows = days.slice(offset, offset + 8).map(day => {
        const values = buildComparisonExtraMetrics({ rowsA: byDay.get(day) ?? [], rowsB: [], headers, keys: metricPage.map(metric => metric.key), platform: "META", currencySymbol, objective: "", costLabel: "" });
        return { date: dailyRangeLabel({ startIso: day, endIso: day }), values: metricPage.map(metric => values.find(value => value.key === metric.key)?.formattedA ?? "N/A") };
      });
      pages.push({ metrics: metricPage.map(({ key, label }) => ({ key, label })), rows });
    }
  }
  return pages;
}

export function dailyExtraMetricGuide(tables: DailyExtraTable[] = [], objectives: { label: string; costLabel: string }[] = [], excluded: string[] = []) {
  const metrics = [...[{ key: "spend", label: "AD SPEND" }, { key: "reach", label: "REACH" }, { key: "impressions", label: "IMPRESSIONS" }, { key: "ctr", label: "CTR (ALL)" }, { key: "cpc_all", label: "CPC (ALL)" }].filter(metric => !excluded.includes(metric.key)), ...objectives.flatMap(column => { const keys = objectiveMetricKeys(column.label); return [...(dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_results",column.label),excluded) ? [] : [{ key: keys.resultKey ?? column.label, label: column.label }]), ...(dailyMetricIsExcluded(dailyObjectiveMetricKey("objective_cost",column.label),excluded) ? [] : [{ key: keys.costKey ?? column.costLabel, label: column.costLabel }])]; }), ...tables.flatMap(table => table.metrics)];
  return [...new Map(metrics.map(metric => [metric.key, { term: metric.label, explanation: findMetaMetricByKey(metric.key)?.explanation ?? metric.label }])).values()];
}
