import { campaignBrief } from "./portfolio";
import type { CampaignPerformance, PeriodMetrics } from "./facts";
export interface DashboardMetric {
  key: string;
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  unit?: "money" | "percent" | "multiple";
  comparable?: boolean;
}
const words = (text: string) =>
  text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
export function deliveryMetrics(
  a: PeriodMetrics,
  b: PeriodMetrics,
): DashboardMetric[] {
  const row = (
    key: string,
    label: string,
    field: keyof PeriodMetrics,
    unit?: DashboardMetric["unit"],
  ): DashboardMetric => ({
    key,
    label,
    current: a[field],
    previous: b[field],
    unit,
  });
  return [
    row("spend", "Amount spent", "spend", "money"),
    row("impressions", "Impressions", "impressions"),
    row("reach", "Reach", "reach"),
    row("link_clicks", "Link clicks", "linkClicks"),
    row("cpc_link", "CPC (cost per link click)", "linkCpc", "money"),
    {
      key: "cpm",
      label: "CPM (per 1,000 impressions)",
      current: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null,
      previous: b.impressions > 0 ? (b.spend / b.impressions) * 1000 : null,
      unit: "money",
    },
    row("ctr", "CTR (all)", "ctr", "percent"),
  ];
}
export function outcomeMetrics(c: CampaignPerformance): DashboardMetric[] {
  return [
    {
      key: "results",
      label: `Results · ${words(c.objective)}`,
      current: c.current.results,
      previous: c.previous.results,
      comparable: c.comparableResults,
    },
    {
      key: "cpr",
      label: words(c.costLabel),
      current: c.current.cpr,
      previous: c.previous.cpr,
      unit: "money",
      comparable: c.comparableResults,
    },
    ...(/purchase/i.test(c.objective)
      ? [
          {
            key: "roas",
            label: "Purchase ROAS",
            current: c.current.roas,
            previous: c.previous.roas,
            unit: "multiple" as const,
            comparable: c.comparableResults,
          },
          {
            key: "purchase_value",
            label: "Purchases conversion value",
            current: c.current.purchaseValue,
            previous: c.previous.purchaseValue,
            unit: "money" as const,
            comparable: c.comparableResults,
          },
        ]
      : []),
  ];
}
export function additionalMetrics(c: CampaignPerformance): DashboardMetric[] {
  const a = c.current,
    b = c.previous;
  const row = (
    key: string,
    label: string,
    field: keyof PeriodMetrics,
    unit?: DashboardMetric["unit"],
  ): DashboardMetric => ({
    key,
    label,
    current: a[field],
    previous: b[field],
    unit,
  });
  const metrics: DashboardMetric[] = [];
  const has = (field: keyof PeriodMetrics) =>
    a[field] != null || b[field] != null;
  if (!/landing page/i.test(c.objective) && has("landingPageViews"))
    metrics.push(
      row("landing_page_views", "Landing page views", "landingPageViews"),
      row(
        "cost_per_landing_page_view",
        "Cost per landing page view",
        "landingPageCost",
        "money",
      ),
    );
  if (!/meta form/i.test(c.objective) && has("metaLeads"))
    metrics.push(
      row("leads", "Meta leads", "metaLeads"),
      row("cost_per_lead", "Cost per Meta lead", "metaLeadCost", "money"),
    );
  if (!/website leads/i.test(c.objective) && has("websiteLeads"))
    metrics.push(
      row("website_leads", "Website leads", "websiteLeads"),
      row(
        "cost_per_website_lead",
        "Cost per website lead",
        "websiteLeadCost",
        "money",
      ),
    );
  if (!/purchase/i.test(c.objective) && has("purchases"))
    metrics.push(
      row("purchases", "Purchases", "purchases"),
      row("cost_per_purchase", "Cost per purchase", "purchaseCost", "money"),
    );
  if (!/add to cart/i.test(c.objective) && has("addToCart"))
    metrics.push(row("conversions_add_to_cart", "Add to cart", "addToCart"));
  if (!/checkout/i.test(c.objective) && has("initiateCheckout"))
    metrics.push(
      row("conversions_checkout", "Initiate checkout", "initiateCheckout"),
    );
  return [
    ...metrics,
    row("clicks_all", "Clicks (all)", "clicks"),
    row("cpc_all", "CPC (all clicks)", "cpc", "money"),
  ];
}

/** Keep an issue visible even when a primary improvement coexists with a supporting warning. */
export function comparisonCampaignState(c: CampaignPerformance) {
  if (c.signals.some((s) => s.tone === "critical")) return "critical";
  if (c.signals.some((s) => s.tone === "warning")) return "review";
  return campaignBrief(c).state;
}
