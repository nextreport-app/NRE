import { ServiceError } from "@/lib/service-error";
import { resolveObjectiveFromResultType } from "../result-type-map";
import type { MetaInsightRow } from "@/lib/meta-api";
import { formatCtrForManualCsv, normalizeDateFormat } from "./api-csv-normalize";
import {
  manualExportPrimaryResult,
  pickManualExportResult,
  pickResultAction,
  pickResultFromAdsManagerFields,
} from "./manual-export-mapper";

/** Matches manual Meta daily export columns (NRE import + validate). */
export const META_CSV_HEADERS = [
  "Campaign name",
  "Ad set name",
  "Day",
  "Result type",
  "Results",
  "Amount spent (USD)",
  "Cost per result",
  "Reach",
  "Impressions",
  "CTR (all)",
  "CPC (all)",
  "Link clicks",
  "Frequency",
  "Landing page views",
  "Cost per landing page view",
  "Meta leads",
  "Website leads",
  "Cost per lead",
  "Messaging conversations started",
  "Cost per messaging conversation started",
  "Clicks (all)",
  "Campaign ID",
  "Ad set ID",
  "CTR (link click-through rate)",
  "NRE API result action",
] as const;

function formatCount(value: number): string {
  return value > 0 ? String(value) : "";
}

function formatMoney(raw: string | undefined): string {
  if (!raw) return "0";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toFixed(2);
}

function actionValueMap(actions: MetaInsightRow["actions"]): Map<string, number> {
  const map = new Map<string, number>();
  for (const action of actions ?? []) {
    const value = parseFloat(action.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(action.action_type, value);
  }
  return map;
}

function costPerActionType(row: MetaInsightRow, actionType: string): string {
  const entry = row.cost_per_action_type?.find((c) => c.action_type === actionType);
  if (entry?.value && parseFloat(entry.value) > 0) return formatMoney(entry.value);
  return "";
}

function evidenceFingerprint(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(evidenceFingerprint).sort());
  if (value && typeof value === "object") return JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, evidenceFingerprint(item)]));
  return JSON.stringify(value) ?? "undefined";
}

export function dedupeInsightsByAdSetDay(rows: MetaInsightRow[]): MetaInsightRow[] {
  const byKey = new Map<string, MetaInsightRow>();
  for (const row of rows) {
    if (!row.campaign_name?.trim() || !row.date_start?.trim()) continue;
    const adset = (row.adset_name ?? "").trim();
    const key = `${row.campaign_id ?? row.campaign_name.trim()}\0${row.adset_id ?? adset}\0${row.date_start.trim()}`;
    const previous = byKey.get(key);
    if (previous && evidenceFingerprint(previous) !== evidenceFingerprint(row)) {
      throw new ServiceError("Meta returned conflicting duplicate daily rows. Retry sync; no conflicting spend or result counts have been discarded.", 422);
    }
    if (!previous) byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** One Meta insight row → one manual-export CSV data row (same fields the upload wizard parses). */
export function insightToManualCsvRow(row: MetaInsightRow): string[] {
  return insightToManualCsvRowWithResult(row, manualExportPrimaryResult(row));
}

export function insightToManualCsvRowWithResult(row: MetaInsightRow, primary: ReturnType<typeof manualExportPrimaryResult>): string[] {
  const actionMap = actionValueMap(row.actions);
  const landingPageViews = actionMap.get("landing_page_view") ?? 0;

  let metaLeads = 0;
  let websiteLeads = 0;
  if (primary) {
    const v = parseFloat(primary.value);
    if (resolveObjectiveFromResultType(primary.csvResultType)?.key === "website_leads") {
      websiteLeads = v;
    } else if (
      primary.csvResultType.toLowerCase().includes("leads (form)") ||
      primary.action_type.includes("lead_grouped")
    ) {
      // Grouped Meta leads are a secondary metric, not the primary Results.
      // Preserve their own count when the provider supplied it.
      metaLeads = actionMap.get("onsite_conversion.lead_grouped") ?? actionMap.get("onsite_conversion.lead") ?? actionMap.get("leadgen_grouped") ?? v;
    }
  }

  const cpr = primary?.cpr ?? "";

  return [
    row.campaign_name ?? "",
    row.adset_name ?? "",
    row.date_start ? normalizeDateFormat(row.date_start) : "",
    primary?.csvResultType ?? "",
    primary?.value ?? "",
    formatMoney(row.spend),
    cpr,
    row.reach ?? "",
    row.impressions ?? "",
    formatCtrForManualCsv(row.ctr),
    formatMoney(row.cpc),
    row.inline_link_clicks ?? "",
    row.frequency ?? "",
    formatCount(landingPageViews),
    costPerActionType(row, "landing_page_view"),
    formatCount(metaLeads),
    formatCount(websiteLeads),
    primary && resolveObjectiveFromResultType(primary.csvResultType)?.key === "meta_form_leads"
      ? (metaLeads > 0 ? String(Number(row.spend ?? 0) / metaLeads) : "")
      : cpr,
    "",
    "",
    row.clicks ?? "",
    row.campaign_id ?? "",
    row.adset_id ?? "",
    row.inline_link_click_ctr ?? (Number(row.impressions) > 0 ? String(Number(row.inline_link_clicks ?? 0) / Number(row.impressions) * 100) : ""),
    row.configured_result_action ?? primary?.action_type ?? "",
  ];
}

export {
  pickResultAction,
  pickResultFromAdsManagerFields,
  pickManualExportResult,
};
