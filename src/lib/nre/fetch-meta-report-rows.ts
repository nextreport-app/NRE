import {
  fetchMetaAdAccountInsights,
  type MetaInsightAction,
  type MetaInsightRow,
} from "@/lib/meta-api";
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

const OPTIMIZATION_GOAL_ACTION_TYPES: Record<string, readonly string[]> = {
  LEAD_GENERATION: ["onsite_conversion.lead_grouped", "onsite_conversion.lead", "leadgen_grouped", "lead"],
  OUTCOME_LEADS: ["onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "lead"],
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

const META_LEAD_ACTION_TYPES = ["onsite_conversion.lead_grouped", "onsite_conversion.lead", "leadgen_grouped"] as const;
const WEBSITE_LEAD_ACTION_TYPES = ["offsite_conversion.fb_pixel_lead", "website_lead", "onsite_web_lead"] as const;
const LEAD_COST_ACTION_TYPES = [
  ...META_LEAD_ACTION_TYPES,
  ...WEBSITE_LEAD_ACTION_TYPES,
  "lead",
] as const;

/** Maps Meta action_type to the human-readable Result type strings our CSV pipeline expects. */
function actionTypeToCsvResultType(actionType: string): string {
  const map: Record<string, string> = {
    link_click: "Link clicks",
    purchase: "Purchase",
    omni_purchase: "Purchase",
    "offsite_conversion.fb_pixel_purchase": "Purchase",
    lead: "Leads",
    "offsite_conversion.fb_pixel_lead": "Website leads",
    website_lead: "Website leads",
    onsite_web_lead: "Website leads",
    "onsite_conversion.lead_grouped": "Leads (form)",
    "onsite_conversion.lead": "Leads (form)",
    leadgen_grouped: "Leads (form)",
    landing_page_view: "Landing page view",
    mobile_app_install: "App installs",
    omni_app_install: "App installs",
    post_engagement: "Post engagements",
    page_like: "Page likes",
    video_view: "Video views",
    thruplay: "Video views",
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
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

/** Picks the objective-aligned result — NOT the highest action count (link clicks must not steal leads). */
export function pickResultAction(row: MetaInsightRow): { action_type: string; value: string } | null {
  const map = actionValueMap(row.actions);
  if (map.size === 0) return null;

  if (row.optimization_goal) {
    const goalKey = row.optimization_goal.toUpperCase();
    const goalActions = OPTIMIZATION_GOAL_ACTION_TYPES[goalKey];
    if (goalActions) {
      const match = firstActionWithValue(map, goalActions);
      if (match) return match;
    }
  }

  return firstActionWithValue(map, RESULT_ACTION_PRIORITY);
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

function insightToCsvRow(row: MetaInsightRow): string[] {
  const actionMap = actionValueMap(row.actions);
  const result = pickResultAction(row);
  const cpr = result ? costPerActionType(row.cost_per_action_type, [result.action_type]) : "";

  const metaLeads = sumActionValues(actionMap, META_LEAD_ACTION_TYPES);
  const websiteLeads = sumActionValues(actionMap, WEBSITE_LEAD_ACTION_TYPES);
  const landingPageViews = actionMap.get("landing_page_view") ?? 0;

  // Generic "lead" only when no dedicated lead columns were populated — avoids double-counting.
  let metaLeadsOut = metaLeads;
  let websiteLeadsOut = websiteLeads;
  const genericLead = actionMap.get("lead") ?? 0;
  if (genericLead > 0 && metaLeadsOut === 0 && websiteLeadsOut === 0) {
    if (result?.action_type && (WEBSITE_LEAD_ACTION_TYPES as readonly string[]).includes(result.action_type)) {
      websiteLeadsOut = genericLead;
    } else {
      metaLeadsOut = genericLead;
    }
  }

  const costPerLead = costPerActionType(row.cost_per_action_type, LEAD_COST_ACTION_TYPES);
  const costPerLpv = costPerActionType(row.cost_per_action_type, ["landing_page_view"]);

  return [
    row.campaign_name ?? "",
    row.adset_name ?? "",
    row.date_start ? isoToCsvDay(row.date_start) : "",
    result ? actionTypeToCsvResultType(result.action_type) : "",
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
