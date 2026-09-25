import type { MetaInsightRow } from "@/lib/meta-api";
import { isoToCsvDay } from "../rows-to-csv";
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
  "CPC (cost per link click)",
  "Link clicks",
  "Frequency",
  "Landing page views",
  "Cost per landing page view",
  "Meta leads",
  "Website leads",
  "Cost per lead",
  "Messaging conversations started",
  "Cost per messaging conversation started",
] as const;

function formatCount(value: number): string {
  return value > 0 ? String(value) : "";
}

function formatPercent(raw: string | undefined): string {
  if (!raw) return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  const pct = n <= 1 && n > 0 ? n * 100 : n;
  return `${pct.toFixed(2)}%`;
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

export function dedupeInsightsByAdSetDay(rows: MetaInsightRow[]): MetaInsightRow[] {
  const byKey = new Map<string, MetaInsightRow>();
  for (const row of rows) {
    if (!row.campaign_name?.trim() || !row.date_start?.trim()) continue;
    const adset = (row.adset_name ?? "").trim();
    const key = `${row.campaign_name.trim()}\0${adset}\0${row.date_start.trim()}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()];
}

/** One Meta insight row → one manual-export CSV data row (same fields the upload wizard parses). */
export function insightToManualCsvRow(row: MetaInsightRow): string[] {
  const primary = manualExportPrimaryResult(row);
  const actionMap = actionValueMap(row.actions);
  const landingPageViews = actionMap.get("landing_page_view") ?? 0;

  let metaLeads = 0;
  let websiteLeads = 0;
  if (primary) {
    const v = parseFloat(primary.value);
    if (primary.csvResultType.toLowerCase().includes("website submission")) {
      websiteLeads = v;
    } else if (
      primary.csvResultType.toLowerCase().includes("leads (form)") ||
      primary.action_type.includes("lead_grouped")
    ) {
      metaLeads = v;
    }
  }

  const cpr = primary?.cpr ?? "";

  return [
    row.campaign_name ?? "",
    row.adset_name ?? "",
    row.date_start ? isoToCsvDay(row.date_start) : "",
    primary?.csvResultType ?? "",
    primary?.value ?? "",
    formatMoney(row.spend),
    cpr,
    row.reach ?? "",
    row.impressions ?? "",
    formatPercent(row.ctr),
    formatMoney(row.cpc),
    row.inline_link_clicks ?? "",
    row.frequency ?? "",
    formatCount(landingPageViews),
    costPerActionType(row, "landing_page_view"),
    formatCount(metaLeads),
    formatCount(websiteLeads),
    cpr,
    "",
    "",
  ];
}

export {
  pickResultAction,
  pickResultFromAdsManagerFields,
  pickManualExportResult,
};
