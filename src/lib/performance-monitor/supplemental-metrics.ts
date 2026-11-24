import type { MetaInsightRow } from "../meta-api";
import type { PerformanceFacts, PeriodMetrics } from "./facts";
import { decisionSignals } from "./decision";
const number = (raw: unknown): number | null =>
  raw == null ||
  String(raw).trim() === "" ||
  !Number.isFinite(Number(raw)) ||
  Number(raw) < 0
    ? null
    : Number(raw);
/** Aliases overlap: select one reported action; never sum a total and its website/onsite children. */
function action(row: MetaInsightRow, aliases: string[]): number | null {
  if (!Array.isArray(row.actions)) return null;
  for (const key of aliases) {
    const matches = row.actions.filter((a) => a.action_type === key);
    if (matches.length > 1) return null;
    if (matches.length) return number(matches[0].value);
  }
  // An omitted action does not prove zero under provider privacy/availability restrictions.
  return null;
}
export function supplementalMetrics(
  row: MetaInsightRow,
): Partial<PeriodMetrics> {
  const spend = number(row.spend),
    linkClicks = number(row.inline_link_clicks),
    landingPageViews = action(row, ["landing_page_view"]),
    metaLeads = action(row, [
      "onsite_conversion.lead_grouped",
      "onsite_conversion.lead",
      "leadgen_grouped",
    ]),
    websiteLeads = action(row, ["offsite_conversion.fb_pixel_lead"]),
    purchases = action(row, [
      "omni_purchase",
      "purchase",
      "offsite_conversion.fb_pixel_purchase",
      "onsite_conversion.purchase",
    ]);
  const cost = (count: number | null) =>
    spend !== null && count !== null && count > 0 ? spend / count : null;
  return {
    reach: number(row.reach),
    linkClicks,
    linkCpc: cost(linkClicks),
    landingPageViews,
    landingPageCost: cost(landingPageViews),
    metaLeads,
    websiteLeads,
    metaLeadCost: cost(metaLeads),
    websiteLeadCost: cost(websiteLeads),
    purchases,
    purchaseCost: cost(purchases),
    addToCart: action(row, [
      "omni_add_to_cart",
      "add_to_cart",
      "offsite_conversion.fb_pixel_add_to_cart",
    ]),
    initiateCheckout: action(row, [
      "omni_initiated_checkout",
      "initiate_checkout",
      "offsite_conversion.fb_pixel_initiate_checkout",
    ]),
  };
}
function mergeMetrics(metrics: PeriodMetrics, row: MetaInsightRow) {
  for (const [key, value] of Object.entries(supplementalMetrics(row))) {
    // A failed optional field must not erase a directly observed additive count.
    if (value !== null || metrics[key as keyof PeriodMetrics] == null)
      (metrics as unknown as Record<string, number | null>)[key] = value as
        number | null;
  }
}
export function enrichPerformanceMetrics(
  facts: PerformanceFacts,
  evidence: {
    currentCampaigns?: MetaInsightRow[];
    previousCampaigns?: MetaInsightRow[];
    currentAccount?: MetaInsightRow[];
    previousAccount?: MetaInsightRow[];
  },
) {
  for (const [period, key, account, campaigns] of [
    [
      facts.periodA,
      "current",
      evidence.currentAccount,
      evidence.currentCampaigns,
    ],
    [
      facts.periodB,
      "previous",
      evidence.previousAccount,
      evidence.previousCampaigns,
    ],
  ] as const) {
    const valid = (row: MetaInsightRow) =>
      row.date_start === period.startIso && row.date_stop === period.endIso;
    // Unique account reach is reported by Meta at account scope, not the sum of campaign reach.
    if (account?.length === 1 && valid(account[0]))
      mergeMetrics(facts[key], account[0]);
    for (const campaign of facts.campaigns) {
      const matches = campaigns?.filter(
        (row) => row.campaign_id && row.campaign_id === campaign.id,
      );
      if (matches?.length === 1 && valid(matches[0]))
        mergeMetrics(campaign[key], matches[0]);
      if (campaign.objective === "REACH") {
        campaign[key].results = campaign[key].reach ?? null;
        const reach = campaign[key].reach;
        campaign[key].cpr =
          reach != null && reach > 0
            ? (campaign[key].spend / reach) * 1000
            : null;
      }
    }
  }
  for (const campaign of facts.campaigns) {
    if (campaign.objective === "REACH")
      campaign.comparableResults =
        campaign.comparableResults &&
        campaign.current.results != null &&
        campaign.previous.results != null;
    campaign.signals = decisionSignals(
      campaign.current,
      campaign.previous,
      campaign.comparableResults,
      {
        objective: campaign.objective,
        purchase: /purchase/i.test(campaign.objective),
        target: campaign.target,
        targetMismatch: campaign.targetMismatch,
      },
    );
  }
}
