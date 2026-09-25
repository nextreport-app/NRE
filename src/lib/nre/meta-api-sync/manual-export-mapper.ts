/**
 * Meta API sync — manual CSV export parity (single source of truth).
 *
 * Manual Ads Manager daily exports fill Result type / Results / Cost per result from
 * the Ads Manager "Results" column only (paired results[] + cost_per_result[] on
 * the Insights API). They do NOT treat random action breakdown rows as Results.
 *
 * This module maps each insight day to that same triple, then the shared CSV import
 * path (parseCsv → buildReportData) matches manual upload exactly.
 */
import type { MetaInsightAction, MetaInsightRow } from "@/lib/meta-api";
import {
  campaignNameHaystack,
  isMetaFormLeadsCampaignHaystack,
  isMessagingCampaignHaystack,
  isQuoteRequestCampaignHaystack,
  isReachCampaignHaystack,
  isWebsiteLeadsCampaignHaystack,
} from "../campaign-name-heuristics";
import { metaApiActionToCsvResultType } from "../meta-objective-dictionary";
import { resolveObjectiveFromResultType } from "../result-type-map";

const WEBSITE_LEAD_ACTION_TYPES = [
  "offsite_conversion.fb_pixel_lead",
  "website_lead",
  "onsite_web_lead",
] as const;

const META_LEAD_ACTION_TYPES = [
  "onsite_conversion.lead_grouped",
  "onsite_conversion.lead",
  "leadgen_grouped",
] as const;

const MESSAGING_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply_7d",
  "new_messaging_connection",
  "whatsapp_message_send",
] as const;

const CUSTOM_CONVERSION = /offsite_conversion\.custom\./i;

export type ManualExportPrimaryResult = {
  action_type: string;
  value: string;
  cpr: string;
  csvResultType: string;
};

function actionValueMap(actions: MetaInsightAction[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const action of actions ?? []) {
    const value = parseFloat(action.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(action.action_type, value);
  }
  return map;
}

function formatMoney(n: number): string {
  return n.toFixed(2);
}

function parseIndicator(indicator: string): string | null {
  const trimmed = indicator.trim();
  if (trimmed.startsWith("actions:")) return trimmed.slice("actions:".length);
  if (trimmed.includes(".")) return trimmed;
  return null;
}

function metricValue(entry: { values?: Array<{ value?: string }> }): number {
  const n = parseFloat(entry.values?.[0]?.value ?? "");
  return Number.isFinite(n) ? n : 0;
}

function costForIndicator(
  row: MetaInsightRow,
  indicator: string,
): number {
  for (const entry of row.cost_per_result ?? []) {
    if ((entry.indicator ?? "").trim() !== indicator.trim()) continue;
    const n = metricValue(entry);
    if (n > 0) return n;
  }
  return 0;
}

type CostedAdsManagerResult = { actionType: string; count: number; cost: number };

/** Rows Meta Ads Manager export would treat as having a costed Result that day. */
function costedAdsManagerResults(row: MetaInsightRow): CostedAdsManagerResult[] {
  const out: CostedAdsManagerResult[] = [];
  for (const entry of row.results ?? []) {
    const indicator = entry.indicator ?? "";
    const actionType = parseIndicator(indicator);
    if (!actionType) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicator(row, indicator);
    if (cost <= 0) continue;
    out.push({ actionType, count, cost });
  }
  return out;
}

function costPerAction(row: MetaInsightRow, actionType: string): number {
  const entry = row.cost_per_action_type?.find((c) => c.action_type === actionType);
  const n = parseFloat(entry?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isWebsiteLeadAction(actionType: string): boolean {
  return (WEBSITE_LEAD_ACTION_TYPES as readonly string[]).includes(actionType);
}

function csvResultTypeForAction(
  actionType: string,
  row: MetaInsightRow,
  websiteLeadPrimary: boolean,
): string {
  if (CUSTOM_CONVERSION.test(actionType)) return "Quote Request Submitted";
  if (websiteLeadPrimary && isWebsiteLeadAction(actionType)) return "website submission";
  return metaApiActionToCsvResultType(actionType);
}

function pack(
  actionType: string,
  count: number,
  cost: number,
  row: MetaInsightRow,
  websiteLeadPrimary: boolean,
): ManualExportPrimaryResult {
  return {
    action_type: actionType,
    value: String(count),
    cpr: formatMoney(cost),
    csvResultType: csvResultTypeForAction(actionType, row, websiteLeadPrimary),
  };
}

function costedWebsiteLeadFromActions(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const map = actionValueMap(row.actions);
  for (const actionType of WEBSITE_LEAD_ACTION_TYPES) {
    const count = map.get(actionType);
    if (count == null || count <= 0) continue;
    const cost = costPerAction(row, actionType);
    if (cost <= 0) continue;
    return pack(actionType, count, cost, row, true);
  }
  return null;
}

function firstCostedInActions(
  row: MetaInsightRow,
  actionTypes: readonly string[],
  websiteLeadPrimary: boolean,
): ManualExportPrimaryResult | null {
  const map = actionValueMap(row.actions);
  for (const actionType of actionTypes) {
    const count = map.get(actionType);
    if (count == null || count <= 0) continue;
    const cost = costPerAction(row, actionType);
    if (cost <= 0) continue;
    return pack(actionType, count, cost, row, websiteLeadPrimary);
  }
  return null;
}

function firstInActions(
  row: MetaInsightRow,
  actionTypes: readonly string[],
  websiteLeadPrimary: boolean,
): ManualExportPrimaryResult | null {
  const map = actionValueMap(row.actions);
  for (const actionType of actionTypes) {
    const count = map.get(actionType);
    if (count == null || count <= 0) continue;
    const cost = costPerAction(row, actionType);
    return pack(actionType, count, cost > 0 ? cost : 0, row, websiteLeadPrimary);
  }
  return null;
}

/** Insights payloads without results[] (tests / older API shapes) — actions only. */
function legacyActionsOnlyResult(row: MetaInsightRow): ManualExportPrimaryResult | null {
  if (row.results?.length) return null;

  const hay = campaignNameHaystack(row.campaign_name, row.adset_name);

  if (isQuoteRequestCampaignHaystack(hay)) {
    const map = actionValueMap(row.actions);
    for (const [actionType, count] of map) {
      if (count <= 0) continue;
      if (CUSTOM_CONVERSION.test(actionType) || /quote[\s_]*request/i.test(actionType)) {
        const cost = costPerAction(row, actionType);
        return pack(actionType, count, cost > 0 ? cost : 0, row, false);
      }
    }
  }

  if (isMessagingCampaignHaystack(hay)) {
    return firstInActions(row, MESSAGING_ACTION_TYPES, false);
  }

  if (isMetaFormLeadsCampaignHaystack(hay)) {
    return firstInActions(row, META_LEAD_ACTION_TYPES, false);
  }

  if (isWebsiteLeadCampaign(row)) {
    return costedWebsiteLeadFromActions(row);
  }

  const goal = row.optimization_goal?.toUpperCase();
  if (goal === "LEAD_GENERATION" || goal === "OUTCOME_LEADS") {
    const meta = firstInActions(row, META_LEAD_ACTION_TYPES, false);
    if (meta) return meta;
    const msg = firstInActions(row, MESSAGING_ACTION_TYPES, false);
    if (msg) return msg;
  }

  return null;
}

function isReachRow(row: MetaInsightRow): boolean {
  return isReachCampaignHaystack(campaignNameHaystack(row.campaign_name, row.adset_name));
}

function isWebsiteLeadCampaign(row: MetaInsightRow): boolean {
  const hay = campaignNameHaystack(row.campaign_name, row.adset_name);
  if (isWebsiteLeadsCampaignHaystack(hay)) return true;
  const goal = row.optimization_goal?.toUpperCase();
  return goal === "OUTCOME_LEADS" || goal === "OFFSITE_CONVERSIONS";
}

function pickWebsiteLeadManualExport(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const costed = costedAdsManagerResults(row);

  const fromWebIndicator = costed.find((c) => isWebsiteLeadAction(c.actionType));
  if (fromWebIndicator) {
    return pack(fromWebIndicator.actionType, fromWebIndicator.count, fromWebIndicator.cost, row, true);
  }

  const pixelFromActions = costedWebsiteLeadFromActions(row);

  if (!row.results?.length) {
    return pixelFromActions;
  }

  const leadInResults = costed.find((c) => c.actionType === "lead");
  if (!leadInResults) {
    return null;
  }

  if (pixelFromActions && leadInResults.count === parseFloat(pixelFromActions.value)) {
    return pixelFromActions;
  }

  return null;
}

function pickQuoteManualExport(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const costed = costedAdsManagerResults(row);
  for (const c of costed) {
    if (CUSTOM_CONVERSION.test(c.actionType)) {
      return pack(c.actionType, c.count, c.cost, row, false);
    }
    const label = metaApiActionToCsvResultType(c.actionType);
    if (resolveObjectiveFromResultType(label)?.key === "quote_requests") {
      return pack(c.actionType, c.count, c.cost, row, false);
    }
  }

  const map = actionValueMap(row.actions);
  for (const [actionType, count] of map) {
    if (count <= 0) continue;
    if (/quote[\s_]*request/i.test(actionType)) {
      const cost = costPerAction(row, actionType);
      if (cost > 0) return pack(actionType, count, cost, row, false);
    }
  }
  let bestCustom: { actionType: string; count: number; cost: number } | null = null;
  for (const [actionType, count] of map) {
    if (count <= 0 || !CUSTOM_CONVERSION.test(actionType)) continue;
    const cost = costPerAction(row, actionType);
    if (cost <= 0) continue;
    if (!bestCustom || count > bestCustom.count) {
      bestCustom = { actionType, count, cost };
    }
  }
  if (bestCustom) {
    const pixel = costedWebsiteLeadFromActions(row);
    if (!pixel || bestCustom.count > parseFloat(pixel.value)) {
      return pack(bestCustom.actionType, bestCustom.count, bestCustom.cost, row, false);
    }
  }

  if (!row.results?.length) {
    for (const [actionType, count] of map) {
      if (count <= 0 || !CUSTOM_CONVERSION.test(actionType)) continue;
      return pack(actionType, count, costPerAction(row, actionType) || 0, row, false);
    }
  }
  return null;
}

function pickMessagingManualExport(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const costed = costedAdsManagerResults(row);
  const hit = costed.find((c) => (MESSAGING_ACTION_TYPES as readonly string[]).includes(c.actionType));
  if (hit) return pack(hit.actionType, hit.count, hit.cost, row, false);
  return (
    firstCostedInActions(row, MESSAGING_ACTION_TYPES, false) ??
    firstInActions(row, MESSAGING_ACTION_TYPES, false)
  );
}

function pickMetaFormManualExport(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const costed = costedAdsManagerResults(row);
  const hit = costed.find((c) => (META_LEAD_ACTION_TYPES as readonly string[]).includes(c.actionType));
  if (hit) return pack(hit.actionType, hit.count, hit.cost, row, false);
  return (
    firstCostedInActions(row, META_LEAD_ACTION_TYPES, false) ??
    firstInActions(row, META_LEAD_ACTION_TYPES, false)
  );
}

/** Primary Result type / Results / CPR for one insight row — manual export rules. */
export function manualExportPrimaryResult(row: MetaInsightRow): ManualExportPrimaryResult | null {
  if (isReachRow(row)) {
    const reach = parseFloat(row.reach ?? "0");
    if (Number.isFinite(reach) && reach > 0) {
      return {
        action_type: "reach",
        value: row.reach!,
        cpr: "",
        csvResultType: "Reach",
      };
    }
    return null;
  }

  const hay = campaignNameHaystack(row.campaign_name, row.adset_name);

  if (isQuoteRequestCampaignHaystack(hay)) {
    return pickQuoteManualExport(row);
  }

  if (isMessagingCampaignHaystack(hay)) {
    return pickMessagingManualExport(row);
  }

  if (isMetaFormLeadsCampaignHaystack(hay)) {
    return pickMetaFormManualExport(row);
  }

  if (isWebsiteLeadCampaign(row)) {
    const quote = pickQuoteManualExport(row);
    if (quote) return quote;
    return pickWebsiteLeadManualExport(row);
  }

  const costed = costedAdsManagerResults(row);
  if (costed.length > 0) {
    const c = costed[0];
    return pack(c.actionType, c.count, c.cost, row, false);
  }

  const costedFallback = firstCostedInActions(
    row,
    [
      ...META_LEAD_ACTION_TYPES,
      ...WEBSITE_LEAD_ACTION_TYPES,
      ...MESSAGING_ACTION_TYPES,
      "purchase",
      "link_click",
      "landing_page_view",
    ],
    false,
  );
  if (costedFallback) return costedFallback;

  return legacyActionsOnlyResult(row);
}

export function pickResultAction(row: MetaInsightRow): { action_type: string; value: string } | null {
  const primary = manualExportPrimaryResult(row);
  if (!primary) return null;
  return { action_type: primary.action_type, value: primary.value };
}

export function pickResultFromAdsManagerFields(
  row: MetaInsightRow,
): { action_type: string; value: string; cpr: string } | null {
  const primary = manualExportPrimaryResult(row);
  if (!primary) return null;
  return {
    action_type: primary.action_type,
    value: primary.value,
    cpr: primary.cpr,
  };
}

export const pickManualExportResult = pickResultAction;
