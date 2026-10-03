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
import type { MetaInsightAction, MetaInsightResultMetric, MetaInsightRow } from "@/lib/meta-api";
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
  if (!trimmed) return null;
  if (trimmed.startsWith("actions:")) return trimmed.slice("actions:".length);
  if (trimmed.includes(".")) return trimmed;
  // Graph API sometimes sends bare types (e.g. "lead") without an "actions:" prefix.
  if (/^[a-z][a-z0-9_]*$/i.test(trimmed)) return trimmed;
  return null;
}

function metricValue(entry: { values?: Array<{ value?: string }>; value?: string }): number {
  const nested = entry.values?.[0]?.value;
  if (nested != null && nested !== "") {
    const n = parseFloat(nested);
    if (Number.isFinite(n)) return n;
  }
  const direct = entry.value;
  if (direct != null && direct !== "") {
    const n = parseFloat(direct);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function costForIndicatorOnList(
  entries: MetaInsightRow["cost_per_result"] | undefined,
  indicator: string,
): number {
  const want = indicator.trim();
  const wantAction = parseIndicator(want);
  for (const entry of entries ?? []) {
    const ind = (entry.indicator ?? "").trim();
    if (ind !== want && !(wantAction && parseIndicator(ind) === wantAction)) continue;
    const n = metricValue(entry);
    if (n > 0) return n;
  }
  return 0;
}

function costForIndicator(row: MetaInsightRow, indicator: string): number {
  return costForIndicatorOnList(row.cost_per_result, indicator);
}

type CostedAdsManagerResult = { actionType: string; count: number; cost: number };

function costedAdsManagerResultsFrom(
  resultMetrics: MetaInsightResultMetric[] | undefined,
  costMetrics: MetaInsightResultMetric[] | undefined,
): CostedAdsManagerResult[] {
  const out: CostedAdsManagerResult[] = [];
  for (const entry of resultMetrics ?? []) {
    const indicator = entry.indicator ?? "";
    const actionType = parseIndicator(indicator);
    if (!actionType) continue;
    const count = metricValue(entry);
    if (count <= 0) continue;
    const cost = costForIndicatorOnList(costMetrics, indicator);
    if (cost <= 0) continue;
    out.push({ actionType, count, cost });
  }
  return out;
}

/** Rows Meta Ads Manager export would treat as having a costed Result that day. */
function costedAdsManagerResults(row: MetaInsightRow): CostedAdsManagerResult[] {
  return costedAdsManagerResultsFrom(row.results, row.cost_per_result);
}

function costedObjectiveResults(row: MetaInsightRow): CostedAdsManagerResult[] {
  return costedAdsManagerResultsFrom(row.objective_results, row.cost_per_objective_result);
}

function linkClickCount(row: MetaInsightRow): number {
  const fromInline = parseFloat(row.inline_link_clicks ?? "");
  if (Number.isFinite(fromInline) && fromInline > 0) return fromInline;
  return actionValueMap(row.actions).get("link_click") ?? 0;
}

/** Reject primary results that match link clicks — common Meta/API over-count vs Ads Manager export. */
function isLikelyLinkClickMisattribution(row: MetaInsightRow, count: number): boolean {
  const linkClicks = linkClickCount(row);
  return linkClicks > 0 && count === linkClicks;
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
  if (websiteLeadPrimary && (isWebsiteLeadAction(actionType) || actionType === "lead")) {
    return "website submission";
  }
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

function pickCostedWebsiteLeadFromCostedList(
  row: MetaInsightRow,
  costed: CostedAdsManagerResult[],
): ManualExportPrimaryResult | null {
  const fromWebIndicator = costed.find((c) => isWebsiteLeadAction(c.actionType));
  if (!fromWebIndicator) return null;
  if (isLikelyLinkClickMisattribution(row, fromWebIndicator.count)) return null;
  return pack(fromWebIndicator.actionType, fromWebIndicator.count, fromWebIndicator.cost, row, true);
}

function websitePixelCountFromActions(row: MetaInsightRow): { actionType: string; count: number } | null {
  const map = actionValueMap(row.actions);
  for (const actionType of WEBSITE_LEAD_ACTION_TYPES) {
    const count = map.get(actionType);
    if (count != null && count > 0) return { actionType, count };
  }
  return null;
}

function uncostedMetricCount(
  metrics: MetaInsightResultMetric[] | undefined,
  actionType: string,
): number {
  for (const entry of metrics ?? []) {
    if (parseIndicator(entry.indicator ?? "") !== actionType) continue;
    const count = metricValue(entry);
    if (count > 0) return count;
  }
  return 0;
}

/** Production 79-lead bug: uncosted actions:lead in results[] + costed pixel CPA only. */
function isInflatedUncostedLeadWithCostedPixelOnly(row: MetaInsightRow): boolean {
  const leadInResults = uncostedMetricCount(row.results, "lead");
  if (leadInResults <= 0) return false;
  if (costForIndicator(row, "actions:lead") > 0) return false;
  return costedWebsiteLeadFromActions(row) != null;
}

/**
 * Meta often sends matching actions:lead + pixel in actions[] but omits cost_per_result[].
 * Ads Manager still shows website submission with CPR = spend / results.
 */
function websiteLeadFromLeadResultsMatchingPixel(row: MetaInsightRow): ManualExportPrimaryResult | null {
  if (isInflatedUncostedLeadWithCostedPixelOnly(row)) return null;

  const pixel = websitePixelCountFromActions(row);
  if (!pixel) return null;
  if (isLikelyLinkClickMisattribution(row, pixel.count)) return null;

  const leadCount = uncostedMetricCount(row.results, "lead");
  if (leadCount <= 0 || leadCount !== pixel.count) return null;

  const pixelInResults = uncostedMetricCount(row.results, pixel.actionType);
  let cost = costForIndicator(row, "actions:lead");
  if (cost <= 0) {
    if (pixelInResults <= 0) return null;
    const spend = parseFloat(row.spend ?? "0");
    if (spend <= 0) return null;
    cost = spend / pixel.count;
  }

  return pack(pixel.actionType, pixel.count, cost, row, true);
}

function uncostedWebsiteMetricCountInResults(row: MetaInsightRow, actionType: string): number {
  if (costForIndicator(row, `actions:${actionType}`) > 0) return 0;
  return uncostedMetricCount(row.results, actionType);
}

function resultsHaveUncostedWebsiteMetric(row: MetaInsightRow): boolean {
  for (const actionType of WEBSITE_LEAD_ACTION_TYPES) {
    if (uncostedWebsiteMetricCountInResults(row, actionType) > 0) return true;
  }
  return false;
}

/** Single website submission when uncosted offsite=1 in results[] matches actions (not CPA-only noise). */
function websiteLeadFromOffsiteCostPerAction(row: MetaInsightRow): ManualExportPrimaryResult | null {
  if (!isWebsiteLeadCampaign(row)) return null;
  if (costedAdsManagerResults(row).length > 0) return null;

  const map = actionValueMap(row.actions);
  const count = map.get("offsite_conversion.fb_pixel_lead") ?? 0;
  if (count !== 1) return null;
  if (isLikelyLinkClickMisattribution(row, count)) return null;

  const offsiteR = uncostedWebsiteMetricCountInResults(row, "offsite_conversion.fb_pixel_lead");
  if (offsiteR !== 1) return null;

  const spend = parseFloat(row.spend ?? "0");
  if (spend <= 0) return null;
  const cost = costPerAction(row, "offsite_conversion.fb_pixel_lead");
  return pack("offsite_conversion.fb_pixel_lead", 1, cost > 0 ? cost : spend, row, true);
}

function shouldRejectUncostedOnsiteCount(
  row: MetaInsightRow,
  count: number,
  offsiteA: number,
  lpv: number,
): boolean {
  if (count < 1) return true;
  if (offsiteA > 1) return true;
  if (isLikelyLinkClickMisattribution(row, count)) return true;
  if (lpv > 0 && count >= lpv) return true;
  const spend = parseFloat(row.spend ?? "0");
  if (spend > 0 && spend / count < 7) return true;
  if (count === 1) return false;
  const linkClicks = linkClickCount(row);
  if (linkClicks <= count * 2 + 4) return true;
  return false;
}

/**
 * Uncosted results[] (no cost_per_result pairs) — Credit Firm live API (deploy 036ab1c panel).
 * Strict exact match when results[] carries website counts; otherwise CPA offsite=1 or guarded onsite in actions.
 */
function websiteLeadFromUncostedManualExportParity(row: MetaInsightRow): ManualExportPrimaryResult | null {
  if (!isWebsiteLeadCampaign(row)) return null;
  if (costedAdsManagerResults(row).length > 0) return null;

  const fromCpa = websiteLeadFromOffsiteCostPerAction(row);
  if (fromCpa) return fromCpa;

  const map = actionValueMap(row.actions);
  const lpv = map.get("landing_page_view") ?? 0;
  const offsiteA = map.get("offsite_conversion.fb_pixel_lead") ?? 0;
  const onsiteA = map.get("onsite_web_lead") ?? 0;
  const offsiteR = uncostedWebsiteMetricCountInResults(row, "offsite_conversion.fb_pixel_lead");
  const onsiteR = uncostedWebsiteMetricCountInResults(row, "onsite_web_lead");

  const spend = parseFloat(row.spend ?? "0");
  if (spend <= 0) return null;

  if (
    offsiteR > 0 &&
    offsiteR === offsiteA &&
    !isLikelyLinkClickMisattribution(row, offsiteR)
  ) {
    return pack("offsite_conversion.fb_pixel_lead", offsiteR, spend / offsiteR, row, true);
  }

  if (
    onsiteR > 0 &&
    onsiteR === onsiteA &&
    offsiteR === 0 &&
    offsiteA <= 1 &&
    !shouldRejectUncostedOnsiteCount(row, onsiteR, offsiteA, lpv)
  ) {
    return pack("onsite_web_lead", onsiteR, spend / onsiteR, row, true);
  }

  // results[] has website counts corroborated by actions (actions may round higher).
  for (const actionType of WEBSITE_LEAD_ACTION_TYPES) {
    const r = uncostedWebsiteMetricCountInResults(row, actionType);
    if (r <= 0) continue;
    const a = map.get(actionType) ?? 0;
    if (a < r) continue;
    if (isLikelyLinkClickMisattribution(row, r)) continue;

    if (actionType === "offsite_conversion.fb_pixel_lead" && r === 1 && costPerAction(row, actionType) <= 0) {
      continue;
    }
    if (actionType === "onsite_web_lead") {
      if (shouldRejectUncostedOnsiteCount(row, r, offsiteA, lpv)) continue;
      if (offsiteR > 0) continue;
    }

    return pack(actionType, r, spend / r, row, true);
  }

  return null;
}

function websiteLeadFromUncostedWebsiteInResults(row: MetaInsightRow): ManualExportPrimaryResult | null {
  return websiteLeadFromUncostedManualExportParity(row);
}

/** @deprecated alias */
function websiteLeadFromUncostedResultsMetricsOnly(row: MetaInsightRow): ManualExportPrimaryResult | null {
  return websiteLeadFromUncostedManualExportParity(row);
}

/** Uncosted website pixel in results[] when count matches actions (objective channel missing). */
function websiteLeadFromUncostedResultsPixel(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const pixel = websitePixelCountFromActions(row);
  if (!pixel) return null;
  if (isLikelyLinkClickMisattribution(row, pixel.count)) return null;

  const pixelInResults = uncostedMetricCount(row.results, pixel.actionType);
  if (pixelInResults <= 0 || pixelInResults !== pixel.count) return null;
  if (costForIndicator(row, `actions:${pixel.actionType}`) > 0) return null;

  const spend = parseFloat(row.spend ?? "0");
  if (spend <= 0) return null;
  return pack(pixel.actionType, pixel.count, spend / pixel.count, row, true);
}

/** No results[] — costed pixel CPA, or spend-derived CPR when Meta omits cost_per_action_type. */
function websiteLeadFromActionsWhenNoResultsArray(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const pixel = websitePixelCountFromActions(row);
  if (!pixel) return null;
  if (isLikelyLinkClickMisattribution(row, pixel.count)) return null;

  const costed = costPerAction(row, pixel.actionType);
  if (costed > 0) {
    return pack(pixel.actionType, pixel.count, costed, row, true);
  }

  const spend = parseFloat(row.spend ?? "0");
  if (spend <= 0) return null;

  // Incidental fb_pixel_lead=1 on blank days (no results[] / objective) — manual export stays blank.
  if (pixel.count === 1) return null;

  return pack(pixel.actionType, pixel.count, spend / pixel.count, row, true);
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

/** Non-lead costed objective rows (traffic, etc.) — manual export does not use results[] website instead. */
function objectiveBlocksResultsWebsitePick(objectiveCosted: CostedAdsManagerResult[]): boolean {
  return objectiveCosted.some(
    (c) => c.actionType !== "lead" && !isWebsiteLeadAction(c.actionType),
  );
}

/**
 * Manual export uses objective_results + cost_per_objective_result when Meta sends them.
 * Costed website pixel in results[] alone (no objective lead) often over-counts on blank days.
 */
function pickCostedWebsiteFromResultsChannel(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const objectiveCosted = costedObjectiveResults(row);
  const objectiveWebsite = objectiveCosted.find((c) => isWebsiteLeadAction(c.actionType));
  if (objectiveWebsite) {
    return null;
  }
  if (objectiveBlocksResultsWebsitePick(objectiveCosted)) {
    return null;
  }

  const objectiveLead = objectiveCosted.find((c) => c.actionType === "lead");

  const resultsCosted = costedAdsManagerResults(row);
  const websiteCosted = resultsCosted.filter((c) => isWebsiteLeadAction(c.actionType));
  if (websiteCosted.length === 0) {
    return null;
  }

  const webPick = pickCostedWebsiteLeadFromCostedList(row, resultsCosted);
  if (!webPick) return null;

  const webCount = parseFloat(webPick.value);
  if (objectiveLead && webCount !== objectiveLead.count) {
    // Ads Manager "website submission" follows costed pixel in results[]; objective
    // actions:lead is a combined metric and often differs (e.g. 1 vs 3 leads).
    const objectiveIsGenericLead = objectiveLead.actionType === "lead";
    if (!(isWebsiteLeadCampaign(row) && objectiveIsGenericLead)) {
      return null;
    }
  }

  const soleCostedWebsiteInResults =
    websiteCosted.length === 1 &&
    resultsCosted.length === 1 &&
    isWebsiteLeadAction(resultsCosted[0].actionType);

  // Reject impossible website counts vs LPV (Sep 2 bad API: costed pixel 4, LPV 3, manual blank).
  if (soleCostedWebsiteInResults && !objectiveLead) {
    const lpv = actionValueMap(row.actions).get("landing_page_view") ?? 0;
    if (lpv > 0 && webCount > lpv) {
      return null;
    }
  }

  if (isLikelyLinkClickMisattribution(row, webCount)) return null;
  return webPick;
}

function pickWebsiteLeadManualExport(row: MetaInsightRow): ManualExportPrimaryResult | null {
  const fromObjective = pickCostedWebsiteLeadFromCostedList(row, costedObjectiveResults(row));
  if (fromObjective) return fromObjective;

  const fromResults = pickCostedWebsiteFromResultsChannel(row);
  if (fromResults) return fromResults;

  const costedLeadOnly = costedAdsManagerResults(row).find((c) => c.actionType === "lead");
  if (
    costedLeadOnly &&
    isWebsiteLeadCampaign(row) &&
    !costedAdsManagerResults(row).some((c) => isWebsiteLeadAction(c.actionType)) &&
    !isLikelyLinkClickMisattribution(row, costedLeadOnly.count)
  ) {
    return pack("lead", costedLeadOnly.count, costedLeadOnly.cost, row, true);
  }

  const fromLeadMatch = websiteLeadFromLeadResultsMatchingPixel(row);
  if (fromLeadMatch) return fromLeadMatch;

  const fromUncostedResultsPixel = websiteLeadFromUncostedResultsPixel(row);
  if (fromUncostedResultsPixel) return fromUncostedResultsPixel;

  const fromUncostedWebsiteInResults = websiteLeadFromUncostedWebsiteInResults(row);
  if (fromUncostedWebsiteInResults) return fromUncostedWebsiteInResults;

  const hasResultMetrics = (row.results?.length ?? 0) > 0;

  if (!hasResultMetrics) {
    return websiteLeadFromActionsWhenNoResultsArray(row);
  }

  // Costed combined lead in results[] matching costed pixel — real lead day with full CPR payloads.
  const costed = costedAdsManagerResults(row);
  const leadInResults = costed.find((c) => c.actionType === "lead");
  if (leadInResults) {
    const pixelFromActions = costedWebsiteLeadFromActions(row);
    if (
      pixelFromActions &&
      leadInResults.count === parseFloat(pixelFromActions.value) &&
      !isLikelyLinkClickMisattribution(row, parseFloat(pixelFromActions.value))
    ) {
      return pixelFromActions;
    }
    // Live OUTCOME_LEADS website campaigns often expose only costed actions:lead in results[]
    // (no fb_pixel_lead breakdown). Ads Manager still labels these "website submission".
    if (
      isWebsiteLeadCampaign(row) &&
      !costed.some((c) => isWebsiteLeadAction(c.actionType)) &&
      !isLikelyLinkClickMisattribution(row, leadInResults.count)
    ) {
      return pack("lead", leadInResults.count, leadInResults.cost, row, true);
    }
    return null;
  }

  if (isInflatedUncostedLeadWithCostedPixelOnly(row)) {
    return null;
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
    // Only honor quote/custom-conversion Results when the campaign is named for quotes.
    // Stray costed custom conversions on website-lead accounts (e.g. Credit Firm) must not
    // override website submission from manual-export rules.
    if (isQuoteRequestCampaignHaystack(hay)) {
      const quote = pickQuoteManualExport(row);
      if (quote) return quote;
    }
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
