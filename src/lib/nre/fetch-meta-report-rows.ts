import {
  fetchMetaAdAccountInsights,
  type MetaInsightAction,
  type MetaInsightRow,
} from "@/lib/meta-api";
import {
  campaignNameHaystack,
  isMetaFormLeadsCampaignHaystack,
  isMessagingCampaignHaystack,
  isQuoteRequestCampaignHaystack,
  isReachCampaignHaystack,
  isWebsiteLeadsCampaignHaystack,
} from "./campaign-name-heuristics";
import { metaApiActionToCsvResultType } from "./meta-objective-dictionary";
import { resolveObjectiveFromResultType } from "./result-type-map";
import { computeLastNDaysIsoRange } from "./api-date-range";
import { isoToCsvDay, rowsToCsv } from "./rows-to-csv";

/** Matches the real-world Meta daily export column set (see validate.test.ts + download guide). */
const META_CSV_HEADERS = [
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

/** Objective-aligned result actions — never pick link_click/LPV when a conversion action exists. */
const RESULT_ACTION_PRIORITY = [
  "onsite_conversion.lead_grouped",
  "onsite_conversion.lead",
  "leadgen_grouped",
  "offsite_conversion.fb_pixel_lead",
  "website_lead",
  "onsite_web_lead",
  "lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply_7d",
  "new_messaging_connection",
  "whatsapp_message_send",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "initiate_checkout",
  "add_to_cart",
  "landing_page_view",
  "link_click",
  "mobile_app_install",
  "omni_app_install",
  "post_engagement",
  "page_like",
  "video_view",
  "thruplay",
] as const;

const MESSAGING_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.messaging_first_reply_7d",
  "new_messaging_connection",
  "whatsapp_message_send",
] as const;

const META_LEAD_ACTION_TYPES = ["onsite_conversion.lead_grouped", "onsite_conversion.lead", "leadgen_grouped"] as const;
const WEBSITE_LEAD_ACTION_TYPES = ["offsite_conversion.fb_pixel_lead", "website_lead", "onsite_web_lead"] as const;

const OPTIMIZATION_GOAL_ACTION_TYPES: Record<string, readonly string[]> = {
  // Lead-form and website-lead actions must rank above messaging here — Meta
  // can attach incidental messaging counts to any lead-family campaign, and
  // treating messaging first (old order) mislabeled website-leads campaigns
  // like "FullGorillaApparel_Leads" as MESSAGING / CONVERSATIONS in API sync.
  LEAD_GENERATION: [
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead",
    "leadgen_grouped",
    ...WEBSITE_LEAD_ACTION_TYPES,
    "lead",
    ...MESSAGING_ACTION_TYPES,
  ],
  OUTCOME_LEADS: [
    ...WEBSITE_LEAD_ACTION_TYPES,
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead",
    "leadgen_grouped",
    "lead",
    ...MESSAGING_ACTION_TYPES,
  ],
  MESSAGES: [...MESSAGING_ACTION_TYPES],
  CONVERSATIONS: [...MESSAGING_ACTION_TYPES],
  QUALITY_LEAD: ["onsite_conversion.lead_grouped", "onsite_conversion.lead", "lead"],
  LINK_CLICKS: ["link_click"],
  LANDING_PAGE_VIEWS: ["landing_page_view"],
  OFFSITE_CONVERSIONS: ["offsite_conversion.fb_pixel_lead", "offsite_conversion.fb_pixel_purchase", "purchase"],
  CONVERSIONS: ["offsite_conversion.fb_pixel_purchase", "omni_purchase", "purchase"],
  APP_INSTALLS: ["mobile_app_install", "omni_app_install"],
  POST_ENGAGEMENT: ["post_engagement"],
  PAGE_LIKES: ["page_like"],
  THRUPLAY: ["video_view", "thruplay"],
};

const LEAD_COST_ACTION_TYPES = [
  ...META_LEAD_ACTION_TYPES,
  ...WEBSITE_LEAD_ACTION_TYPES,
  "lead",
] as const;

const CUSTOM_CONVERSION_ACTION = /offsite_conversion\.custom\./i;

/** Maps Meta action_type to the human-readable Result type strings our CSV pipeline expects. */
function actionTypeToCsvResultType(
  actionType: string,
  row?: MetaInsightRow,
  pickedAsPrimaryResult = false,
): string {
  if (pickedAsPrimaryResult && CUSTOM_CONVERSION_ACTION.test(actionType)) {
    // Meta API reports quote-request optimizations as anonymous custom.* actions —
    // manual CSV exports label them "Quote Request Submitted" regardless of campaign name.
    return "Quote Request Submitted";
  }
  if (row && isQuoteRequestCampaignRow(row) && CUSTOM_CONVERSION_ACTION.test(actionType)) {
    return "Quote Request Submitted";
  }
  if (
    pickedAsPrimaryResult &&
    row &&
    usesWebsiteLeadResultPicking(row) &&
    (WEBSITE_LEAD_ACTION_TYPES as readonly string[]).includes(actionType)
  ) {
    // Manual Meta exports for website-lead campaigns use "website submission".
    return "website submission";
  }
  return metaApiActionToCsvResultType(actionType);
}

function isMetaLeadActionType(actionType: string): boolean {
  return (META_LEAD_ACTION_TYPES as readonly string[]).includes(actionType);
}

function isWebsiteLeadActionType(actionType: string): boolean {
  return (WEBSITE_LEAD_ACTION_TYPES as readonly string[]).includes(actionType);
}

function isMessagingActionType(actionType: string): boolean {
  return (MESSAGING_ACTION_TYPES as readonly string[]).includes(actionType);
}

/** Lead columns mirror manual CSV: only populated when that action was picked as Results. */
function leadColumnsFromPickedResult(
  row: MetaInsightRow,
  result: { action_type: string; value: string } | null,
): { metaLeadsOut: number; websiteLeadsOut: number } {
  if (!result) return { metaLeadsOut: 0, websiteLeadsOut: 0 };
  const value = parseFloat(result.value);
  if (!Number.isFinite(value) || value <= 0) return { metaLeadsOut: 0, websiteLeadsOut: 0 };

  if (isMetaLeadActionType(result.action_type)) {
    return { metaLeadsOut: value, websiteLeadsOut: 0 };
  }
  if (isWebsiteLeadActionType(result.action_type)) {
    return { metaLeadsOut: 0, websiteLeadsOut: value };
  }
  if (result.action_type === "lead") {
    const typedCampaign =
      isMessagingCampaignRow(row) ||
      isMetaFormLeadsCampaignRow(row) ||
      usesWebsiteLeadResultPicking(row) ||
      isQuoteRequestCampaignRow(row);
    if (typedCampaign) return { metaLeadsOut: 0, websiteLeadsOut: 0 };
    return { metaLeadsOut: value, websiteLeadsOut: 0 };
  }
  return { metaLeadsOut: 0, websiteLeadsOut: 0 };
}

function firstCustomConversionAction(map: Map<string, number>): { action_type: string; value: string } | null {
  let best: { action_type: string; value: string } | null = null;
  for (const [actionType, value] of map) {
    if (value <= 0 || !CUSTOM_CONVERSION_ACTION.test(actionType)) continue;
    if (!best || value > parseFloat(best.value)) {
      best = { action_type: actionType, value: String(value) };
    }
  }
  return best;
}

function actionValueMap(actions: MetaInsightAction[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const action of actions ?? []) {
    const value = parseFloat(action.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(action.action_type, value);
  }
  return map;
}

function firstActionWithValue(
  map: Map<string, number>,
  actionTypes: readonly string[],
): { action_type: string; value: string } | null {
  for (const actionType of actionTypes) {
    const value = map.get(actionType);
    if (value != null && value > 0) {
      return { action_type: actionType, value: String(value) };
    }
  }
  return null;
}

const LEAD_FAMILY_GOALS = new Set([
  "LEAD_GENERATION",
  "OUTCOME_LEADS",
  "QUALITY_LEAD",
  "MESSAGES",
  "CONVERSATIONS",
]);

function isMessagingCampaignRow(row: MetaInsightRow): boolean {
  return isMessagingCampaignHaystack(campaignNameHaystack(row.campaign_name, row.adset_name));
}

function isMetaFormLeadsCampaignRow(row: MetaInsightRow): boolean {
  return isMetaFormLeadsCampaignHaystack(campaignNameHaystack(row.campaign_name, row.adset_name));
}

function isWebsiteLeadsCampaignRow(row: MetaInsightRow): boolean {
  return isWebsiteLeadsCampaignHaystack(campaignNameHaystack(row.campaign_name, row.adset_name));
}

function isQuoteRequestCampaignRow(row: MetaInsightRow): boolean {
  return isQuoteRequestCampaignHaystack(campaignNameHaystack(row.campaign_name, row.adset_name));
}

/** Website/offsite lead optimization — manual exports only count costed pixel/web lead days. */
function isWebsiteLeadOptimizationGoal(row: MetaInsightRow): boolean {
  const goal = row.optimization_goal?.toUpperCase();
  return goal === "OUTCOME_LEADS" || goal === "OFFSITE_CONVERSIONS";
}

function usesWebsiteLeadResultPicking(row: MetaInsightRow): boolean {
  return isWebsiteLeadsCampaignRow(row) || isWebsiteLeadOptimizationGoal(row);
}

/**
 * Manual Meta exports leave Results blank on traffic days even when Insights API
 * attaches a single unattributed fb_pixel_lead. Real lead days carry
 * cost_per_action_type for the pixel action (see DC Credit Firm weekly export).
 */
function isIncidentalWebsiteLead(
  row: MetaInsightRow,
  match: { action_type: string; value: string },
): boolean {
  const cost = costPerActionType(row.cost_per_action_type, [match.action_type]);
  if (cost && parseFloat(cost) > 0) return false;
  const leadCount = parseFloat(match.value);
  if (!Number.isFinite(leadCount) || leadCount > 1) return false;
  const map = actionValueMap(row.actions);
  const linkClicks = map.get("link_click") ?? 0;
  if (linkClicks <= 0) return false;
  return true;
}

/** Meta manual exports only show a lead result on days with a real Cost per result. */
function actionHasCostedResult(row: MetaInsightRow, actionType: string): boolean {
  const cost = costPerActionType(row.cost_per_action_type, [actionType]);
  if (!cost) return false;
  const n = parseFloat(cost);
  return Number.isFinite(n) && n > 0;
}

function withCostedResult(
  row: MetaInsightRow,
  match: { action_type: string; value: string } | null,
): { action_type: string; value: string } | null {
  if (!match) return null;
  return actionHasCostedResult(row, match.action_type) ? match : null;
}

function firstWebsiteLeadAction(
  row: MetaInsightRow,
  map: Map<string, number>,
): { action_type: string; value: string } | null {
  for (const actionType of WEBSITE_LEAD_ACTION_TYPES) {
    const value = map.get(actionType);
    if (value == null || value <= 0) continue;
    const match = { action_type: actionType, value: String(value) };
    if (isIncidentalWebsiteLead(row, match)) continue;
    const costed = withCostedResult(row, match);
    if (costed) return costed;
  }
  return null;
}

function firstActionMatchingPattern(
  map: Map<string, number>,
  pattern: RegExp,
): { action_type: string; value: string } | null {
  for (const [actionType, value] of map) {
    if (value > 0 && pattern.test(actionType)) {
      return { action_type: actionType, value: String(value) };
    }
  }
  return null;
}

function pickQuoteRequestAction(map: Map<string, number>): { action_type: string; value: string } | null {
  return (
    firstActionForObjectiveKey(map, "quote_requests") ??
    firstActionMatchingPattern(map, /quote[\s_]*request/i) ??
    firstCustomConversionAction(map)
  );
}

/** Prefer actions whose CSV result_type resolves to a specific objective (same resolver as manual CSV). */
function firstActionForObjectiveKey(
  map: Map<string, number>,
  objectiveKey: string,
): { action_type: string; value: string } | null {
  for (const [actionType, value] of map) {
    if (value <= 0) continue;
    const csvLabel = metaApiActionToCsvResultType(actionType);
    if (resolveObjectiveFromResultType(csvLabel)?.key === objectiveKey) {
      return { action_type: actionType, value: String(value) };
    }
  }
  return null;
}

/** Picks the objective-aligned result — NOT the highest action count (link clicks must not steal leads). */
export function pickResultAction(row: MetaInsightRow): { action_type: string; value: string } | null {
  const map = actionValueMap(row.actions);
  if (map.size === 0) return null;

  const messagingCampaign = isMessagingCampaignRow(row);
  const quoteRequestCampaign = isQuoteRequestCampaignRow(row);

  if (quoteRequestCampaign) {
    const quoteMatch = pickQuoteRequestAction(map);
    if (quoteMatch) return quoteMatch;
    const websiteMatch = firstActionWithValue(map, WEBSITE_LEAD_ACTION_TYPES);
    if (websiteMatch) return websiteMatch;
    return null;
  }

  if (messagingCampaign) {
    const messagingMatch = firstActionWithValue(map, MESSAGING_ACTION_TYPES);
    if (messagingMatch) return messagingMatch;
    // Meta CSV exports leave result blank on non-messaging days — do not fall
    // through to link_click/LPV/incidental lead actions from the Insights API.
    return null;
  }

  if (isMetaFormLeadsCampaignRow(row)) {
    const metaMatch = firstActionWithValue(map, META_LEAD_ACTION_TYPES);
    if (metaMatch) return metaMatch;
    return null;
  }

  if (usesWebsiteLeadResultPicking(row)) {
    // Many "website leads" named campaigns still optimize for a quote-request custom
    // conversion — Meta API exposes that as offsite_conversion.custom.{id}, not fb_pixel_lead.
    const quoteMatch = pickQuoteRequestAction(map);
    if (quoteMatch) return quoteMatch;
    const websiteMatch = firstWebsiteLeadAction(row, map);
    if (websiteMatch) return websiteMatch;
    // Same as Meta CSV: no website-lead result on days without a costed pixel/web
    // lead action — ignore generic `lead`, meta-form, and traffic actions.
    return null;
  }

  if (row.optimization_goal) {
    const goalKey = row.optimization_goal.toUpperCase();
    const goalActions = OPTIMIZATION_GOAL_ACTION_TYPES[goalKey];
    if (goalActions) {
      const match = firstActionWithValue(map, goalActions);
      if (match) {
        if (isWebsiteLeadActionType(match.action_type)) {
          return firstWebsiteLeadAction(row, map);
        }
        return match;
      }
    }
  }

  const fallback = firstActionWithValue(map, RESULT_ACTION_PRIORITY);
  if (!fallback) return null;

  const goalKey = row.optimization_goal?.toUpperCase();
  const isLeadFamily = Boolean(goalKey && LEAD_FAMILY_GOALS.has(goalKey));
  if (isLeadFamily || messagingCampaign) {
    if (fallback.action_type === "link_click" || fallback.action_type === "landing_page_view") {
      return null;
    }
  }

  return fallback;
}

function sumActionValues(map: Map<string, number>, actionTypes: readonly string[]): number {
  let total = 0;
  for (const actionType of actionTypes) {
    total += map.get(actionType) ?? 0;
  }
  return total;
}

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

function costPerActionType(
  costs: MetaInsightAction[] | undefined,
  actionTypes: readonly string[],
): string {
  for (const actionType of actionTypes) {
    const entry = costs?.find((c) => c.action_type === actionType);
    if (entry?.value && parseFloat(entry.value) > 0) {
      return formatMoney(entry.value);
    }
  }
  return "";
}

function isReachCampaignInsightRow(row: MetaInsightRow): boolean {
  return isReachCampaignHaystack(campaignNameHaystack(row.campaign_name ?? "", row.adset_name ?? ""));
}

function actionTypeFromResultsIndicator(indicator: string): string | null {
  const trimmed = indicator.trim();
  if (trimmed.startsWith("actions:")) return trimmed.slice("actions:".length);
  if (trimmed.includes(".")) return trimmed;
  return null;
}

function metricValueFromResultEntry(entry: { values?: Array<{ value?: string }> }): number {
  const raw = entry.values?.[0]?.value;
  const n = parseFloat(raw ?? "");
  return Number.isFinite(n) ? n : 0;
}

/** Prefer Meta's Results / Cost per result fields — same source as Ads Manager exports. */
export function pickResultFromAdsManagerFields(
  row: MetaInsightRow,
): { action_type: string; value: string; cpr: string } | null {
  for (const entry of row.results ?? []) {
    const indicator = entry.indicator?.trim();
    if (!indicator) continue;
    const count = metricValueFromResultEntry(entry);
    if (count <= 0) continue;
    const actionType = actionTypeFromResultsIndicator(indicator);
    if (!actionType) continue;

    let cpr = "";
    for (const costEntry of row.cost_per_result ?? []) {
      if (costEntry.indicator?.trim() !== indicator) continue;
      const costVal = metricValueFromResultEntry(costEntry);
      if (costVal > 0) cpr = formatMoney(String(costVal));
    }
    if (!cpr) {
      cpr = costPerActionType(row.cost_per_action_type, [actionType]);
    }
    return { action_type: actionType, value: String(count), cpr };
  }
  return null;
}

function insightToCsvRow(row: MetaInsightRow): string[] {
  const actionMap = actionValueMap(row.actions);
  const adsManagerResult = pickResultFromAdsManagerFields(row);
  let result: { action_type: string; value: string } | null = adsManagerResult
    ? { action_type: adsManagerResult.action_type, value: adsManagerResult.value }
    : pickResultAction(row);
  if (isReachCampaignInsightRow(row)) {
    const reachVal = parseFloat(row.reach ?? "0");
    if (Number.isFinite(reachVal) && reachVal > 0) {
      result = { action_type: "reach", value: row.reach! };
    }
  }
  const cpr =
    adsManagerResult?.cpr ||
    (result ? costPerActionType(row.cost_per_action_type, [result.action_type]) : "");

  const landingPageViews = actionMap.get("landing_page_view") ?? 0;
  const { metaLeadsOut, websiteLeadsOut } = leadColumnsFromPickedResult(row, result);

  const isLeadFamilyResult =
    result &&
    (isMetaLeadActionType(result.action_type) ||
      isWebsiteLeadActionType(result.action_type) ||
      result.action_type === "lead");
  const costPerLead = isLeadFamilyResult
    ? cpr || costPerActionType(row.cost_per_action_type, LEAD_COST_ACTION_TYPES)
    : "";
  const costPerLpv = costPerActionType(row.cost_per_action_type, ["landing_page_view"]);
  const messagingConversations =
    result && isMessagingActionType(result.action_type) ? parseFloat(result.value) : 0;
  const costPerMessaging =
    result && isMessagingActionType(result.action_type)
      ? cpr || costPerActionType(row.cost_per_action_type, MESSAGING_ACTION_TYPES)
      : "";

  return [
    row.campaign_name ?? "",
    row.adset_name ?? "",
    row.date_start ? isoToCsvDay(row.date_start) : "",
    result ? actionTypeToCsvResultType(result.action_type, row, true) : "",
    result?.value ?? "",
    formatMoney(row.spend),
    cpr,
    row.reach ?? "",
    row.impressions ?? "",
    formatPercent(row.ctr),
    formatMoney(row.cpc),
    row.inline_link_clicks ?? "",
    row.frequency ?? "",
    formatCount(landingPageViews),
    costPerLpv,
    formatCount(metaLeadsOut),
    formatCount(websiteLeadsOut),
    costPerLead,
    formatCount(messagingConversations),
    costPerMessaging,
  ];
}

export interface FetchMetaReportCsvInput {
  accessToken: string;
  adAccountId: string;
  timezone: string;
  now?: Date;
  days?: number;
  /** When set, overrides the default last-N-days window (e.g. previous calendar month sync). */
  sinceIso?: string;
  untilIso?: string;
}

/** Fetches Meta insights and serializes to CSV bytes matching the NRE Meta export shape. */
export async function fetchMetaReportCsv(input: FetchMetaReportCsvInput): Promise<{
  csvText: string;
  rowCount: number;
  sinceIso: string;
  untilIso: string;
}> {
  const { sinceIso, untilIso } =
    input.sinceIso && input.untilIso
      ? { sinceIso: input.sinceIso, untilIso: input.untilIso }
      : computeLastNDaysIsoRange(input.now ?? new Date(), input.timezone, input.days ?? 30);

  const insights = await fetchMetaAdAccountInsights({
    accessToken: input.accessToken,
    adAccountId: input.adAccountId,
    sinceIso,
    untilIso,
  });

  const dataRows = insights
    .filter((r) => r.campaign_name && r.date_start)
    .map(insightToCsvRow);

  const csvText = rowsToCsv([...META_CSV_HEADERS], dataRows);

  return { csvText, rowCount: dataRows.length, sinceIso, untilIso };
}

export { META_CSV_HEADERS };
