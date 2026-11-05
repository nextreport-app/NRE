import type { MetaInsightRow } from "@/lib/meta-api";
import { ServiceError } from "@/lib/service-error";
import { metaApiActionToCsvResultType } from "../meta-objective-dictionary";
import { manualExportPrimaryResult, type ManualExportPrimaryResult } from "./manual-export-mapper";
const action = (indicator: string) => indicator.replace(/^actions:/, "");
/** Prefer an unambiguous primary result supplied by Meta; never infer a conversion count from spend/CPA. */
export function directlyEvidencedResult(row: MetaInsightRow): ManualExportPrimaryResult | null {
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
