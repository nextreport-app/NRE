import type { MetaInsightRow, MetaInsightResultMetric } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";

export type FormResultFailureReason = "missing_results" | "unexpected_indicator" | "invalid_value_shape" | "invalid_count" | "empty_results_with_form_actions" | "conflicting_results";

// Explicit field selection: never serialize the request, token, full row, or
// arbitrary provider properties into a browser-visible diagnostic.
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).slice(0, 200) : null;
function metrics(items: MetaInsightResultMetric[] | undefined) {
  if (!Array.isArray(items)) return null;
  return items.slice(0, 30).map(item => ({
    indicator: text(item?.indicator),
    values: Array.isArray(item?.values) ? item.values.slice(0, 10).map(value => ({ value: text(value?.value) })) : null,
  }));
}
export class FormResultEvidenceError extends ServiceError {
  readonly diagnostic;
  constructor(row: MetaInsightRow, reason: FormResultFailureReason) {
    super(`Meta's primary instant-form Results could not be verified${row.date_start ? ` for ${row.date_start}` : ""}. Download the sync diagnostic for support, or use an Ads Manager CSV. Grouped Meta leads have not been substituted.`, 422);
    this.diagnostic = {
      schema: "nre-meta-form-results-v1" as const,
      reason,
      dateStart: text(row.date_start), dateStop: text(row.date_stop),
      campaignId: text(row.campaign_id), adSetId: text(row.adset_id),
      optimizationGoal: text(row.optimization_goal), spend: text(row.spend),
      attributionMode: "adset_unified", actionReportTime: "impression",
      results: metrics(row.results), objectiveResults: metrics(row.objective_results),
      costPerResult: metrics(row.cost_per_result),
      leadActions: (row.actions ?? []).filter(item => /lead/i.test(item.action_type)).slice(0, 30).map(item => ({ action_type: text(item.action_type), value: text(item.value) })),
    };
  }
}
