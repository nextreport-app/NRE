import type { MetaInsightRow } from "@/lib/meta-api";
import { syntheticResultTypeFromMetaResultIndicator } from "../meta-result-indicator";
import { ServiceError } from "@/lib/service-error";
import { metaApiActionToCsvResultType } from "../meta-objective-dictionary";
import { manualExportPrimaryResult, type ManualExportPrimaryResult } from "./manual-export-mapper";
const action = (indicator: string) => indicator.replace(/^actions:/, "");
/** Read one action type; channels and aliases are never added together. */
function actionCount(row: MetaInsightRow, type: string): number {
  const observed = (row.actions ?? []).filter(item => item.action_type === type);
  const counts = observed.map(item => Number(item.value));
  if (observed.some(item => String(item.value).trim() === "") || counts.some(count => !Number.isFinite(count) || count < 0) || counts.some(count => Math.abs(count - counts[0]) > 1e-8)) {
    throw new ServiceError("Meta returned invalid or duplicate conflicting values within the configured action's own counts. Retry sync; no result total has been estimated.", 422);
  }
  return counts[0] ?? 0;
}

function scalarCount(raw: string | undefined): number {
  const count = raw == null || raw === "" ? 0 : Number(raw);
  if (!Number.isFinite(count) || count < 0) throw new ServiceError("Meta returned an invalid delivery count. Retry sync.", 422);
  return count;
}

/** Configured events and optimization goals define the count; campaign names cannot override them. */
export function directlyEvidencedResult(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const pack = (type: string, count: number, delivery = false): ManualExportPrimaryResult => ({
    action_type: type, value: String(count),
    cpr: !delivery && count > 0 ? String(Number(row.spend ?? 0) / count) : "",
    csvResultType: (row.configured_result_action === type ? row.configured_result_type : undefined) ?? syntheticResultTypeFromMetaResultIndicator(`actions:${type}`) ?? metaApiActionToCsvResultType(type),
  });
  if (row.configured_result_action) {
    // `actions.value` is the scalar total for this request's unified attribution
    // settings. Result/Objective channels are different projections, not duplicate
    // observations. An omitted action is zero, never filled from another channel.
    return pack(row.configured_result_action, actionCount(row, row.configured_result_action));
  }
  // Standard non-website goals also need an explicit source when result channels
  // are excluded from the request. Incidental conversions cannot replace clicks.
  switch (row.optimization_goal?.toUpperCase()) {
    case "LINK_CLICKS": return pack("link_click", row.inline_link_clicks == null ? actionCount(row, "link_click") : scalarCount(row.inline_link_clicks));
    case "LANDING_PAGE_VIEWS": return pack("landing_page_view", actionCount(row, "landing_page_view"));
    case "REACH": return pack("reach", scalarCount(row.reach), true);
    case "IMPRESSIONS": return pack("impressions", scalarCount(row.impressions), true);
    case "LEAD_GENERATION": {
      const type = ["onsite_conversion.lead_grouped", "onsite_conversion.lead", "leadgen_grouped"].find(type => row.actions?.some(item => item.action_type === type)) ?? "onsite_conversion.lead_grouped";
      return pack(type, actionCount(row, type));
    }
  }
  const legacy = manualExportPrimaryResult(row);
  const explicit = (row.results ?? []).map(item => ({ type: action(item.indicator ?? ""), count: Number(item.values?.[0]?.value) })).filter(item => item.type && Number.isFinite(item.count) && item.count > 0);
  if (explicit.length === 1) {
    const {type, count} = explicit[0];
    const cost = (row.cost_per_result ?? []).find(item => action(item.indicator ?? "") === type);
    const cpr = Number(cost?.values?.[0]?.value);
    return { action_type: type, value: String(count), cpr: Number.isFinite(cpr) && cpr > 0 ? String(cpr) : String(Number(row.spend ?? 0) / count), csvResultType: legacy?.action_type === type ? legacy.csvResultType : metaApiActionToCsvResultType(type) };
  }
  if (!legacy) {
    if (explicit.length) throw new ServiceError("Meta returned multiple primary result types for a row that could not be resolved safely. Use CSV reporting for this account while we review its API mapping.", 422);
    return null;
  }
  const count = Number(legacy.value);
  const candidates = [
    ...explicit.filter(item => item.type === legacy.action_type).map(item => item.count),
    ...(row.actions ?? []).filter(item => item.action_type === legacy.action_type).map(item => Number(item.value)),
    ...(legacy.action_type === "reach" ? [Number(row.reach)] : []),
    ...(legacy.action_type === "link_click" ? [Number(row.inline_link_clicks)] : []),
  ];
  if (!candidates.some(value => Number.isFinite(value) && Math.abs(value - count) < 1e-8)) throw new ServiceError("Meta did not supply direct evidence for the mapped result count. We stopped this import rather than estimate conversions from costs. Use CSV reporting for this account while its API mapping is reviewed.", 422);
  return legacy;
}
