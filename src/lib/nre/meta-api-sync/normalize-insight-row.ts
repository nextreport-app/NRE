import type { MetaInsightResultMetric, MetaInsightRow } from "@/lib/meta-api";

type RawMetric = MetaInsightResultMetric & {
  action_type?: string;
  value?: string;
};

function normalizeMetricList(
  metrics: RawMetric[] | undefined,
): MetaInsightResultMetric[] | undefined {
  if (!metrics?.length) return metrics;
  return metrics.map((entry) => {
    const indicator =
      (entry.indicator ?? entry.action_type ?? "").trim() ||
      (typeof entry.value === "string" && entry.value.includes(":") ? entry.value : "");
    let values = entry.values;
    if ((!values || values.length === 0) && entry.value != null && entry.value !== "") {
      values = [{ value: String(entry.value) }];
    }
    return { indicator, values };
  });
}

/** Graph API occasionally varies result metric shape; normalize before mapper rules. */
export function normalizeMetaInsightRow(row: MetaInsightRow): MetaInsightRow {
  return {
    ...row,
    results: normalizeMetricList(row.results as RawMetric[] | undefined),
    cost_per_result: normalizeMetricList(row.cost_per_result as RawMetric[] | undefined),
    objective_results: normalizeMetricList(row.objective_results as RawMetric[] | undefined),
    cost_per_objective_result: normalizeMetricList(
      row.cost_per_objective_result as RawMetric[] | undefined,
    ),
  };
}
