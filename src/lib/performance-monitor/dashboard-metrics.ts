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
  text
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(cpc|cpl|cpm|ctr|roas|lpv|api)\b/gi, (m) => m.toUpperCase());
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

/** A campaign's result aliases are only duplicates when both period values match. */
export function campaignComparisonMetrics(
  c: CampaignPerformance,
): DashboardMetric[] {
  const primary = outcomeMetrics(c);
  const aliases: Record<string, string> = {
    "LINK CLICKS": "link_clicks",
    REACH: "reach",
    "LANDING PAGE VIEWS": "landing_page_views",
    "META FORM LEADS": "leads",
    "WEBSITE LEADS": "website_leads",
    PURCHASES: "purchases",
    "ADD TO CART": "conversions_add_to_cart",
    "INITIATE CHECKOUT": "conversions_checkout",
  };
  const resultKey = aliases[c.objective];
  const costKey =
    c.objective === "LINK CLICKS"
      ? "cpc_link"
      : resultKey
        ? `cost_per_${resultKey}`
        : undefined;
  const seen = new Set(primary.map((m) => m.key));
  return [
    ...primary,
    ...[
      ...deliveryMetrics(c.current, c.previous),
      ...additionalMetrics(c),
    ].filter((m) => {
      if (seen.has(m.key)) return false;
      const match =
        m.key === resultKey
          ? primary[0]
          : m.key === costKey
            ? primary[1]
            : null;
      if (
        match &&
        (m.current != null || m.previous != null) &&
        m.current === match.current &&
        m.previous === match.previous
      )
        return false;
      seen.add(m.key);
      return true;
    }),
  ];
}

/** Goal-level counts stay separate, and costs use only that goal's campaign spend. */
export function accountHighlightMetrics(
  facts: import("./facts").PerformanceFacts,
): DashboardMetric[] {
  const cards: DashboardMetric[] = [
    deliveryMetrics(facts.current, facts.previous)[0],
  ];
  const groups = new Map<string, CampaignPerformance[]>();
  for (const c of facts.campaigns) {
    const key = `${c.objective}\0${c.costLabel}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const sum = (
    campaigns: CampaignPerformance[],
    period: "current" | "previous",
    field: keyof PeriodMetrics,
  ) =>
    campaigns.length && campaigns.every((c) => c[period][field] != null)
      ? campaigns.reduce((n, c) => n + c[period][field]!, 0)
      : null;
  for (const [key, group] of groups) {
    // Unique reach is not additive across campaigns: keep Reach goals individually labeled.
    const subgroups =
      group[0].objective === "REACH" ? group.map((c) => [c]) : [group];
    for (const members of subgroups) {
      const source = members[0],
        id = `${key}-${source.id ?? source.name}`;
      const result = (period: "current" | "previous") =>
        sum(members, period, "results");
      const cost = (period: "current" | "previous") => {
        const count = result(period);
        return count != null && count > 0
          ? (members.reduce((n, c) => n + c[period].spend, 0) / count) *
              (source.objective === "REACH" ||
              /1[,.]?000|1k|cpm/i.test(source.costLabel)
                ? 1000
                : 1)
          : null;
      };
      const costLabel =
        source.objective === "LINK CLICKS" &&
        members.every(
          (c) =>
            c.current.results != null &&
            c.previous.results != null &&
            c.current.results === c.current.linkClicks &&
            c.previous.results === c.previous.linkClicks,
        )
          ? "CPC (cost per link click)"
          : words(source.costLabel);
      const suffix =
        source.objective === "REACH" && group.length > 1
          ? ` · ${source.name}`
          : "";
      cards.push(
        {
          key: `results:${id}`,
          label: `Results · ${words(source.objective)}${suffix}`,
          current: result("current"),
          previous: result("previous"),
          comparable: members.every((c) => c.comparableResults),
        },
        {
          key: `cpr:${id}`,
          label: `${costLabel}${suffix}`,
          current: cost("current"),
          previous: cost("previous"),
          unit: "money",
          comparable: members.every((c) => c.comparableResults),
        },
      );
    }
  }
  if (
    facts.campaigns.some((c) => /lead|landing|link click/i.test(c.objective)) ||
    facts.current.landingPageViews != null ||
    facts.previous.landingPageViews != null
  )
    cards.push({
      key: "landing_page_views",
      label: "Landing page views",
      current:
        facts.current.landingPageViews ??
        sum(facts.campaigns, "current", "landingPageViews"),
      previous:
        facts.previous.landingPageViews ??
        sum(facts.campaigns, "previous", "landingPageViews"),
    });
  return cards;
}

export function remainingAccountMetrics(
  facts: import("./facts").PerformanceFacts,
): DashboardMetric[] {
  const cards = accountHighlightMetrics(facts);
  return deliveryMetrics(facts.current, facts.previous).filter((metric) => {
    if (metric.key === "spend") return false;
    const alias =
      facts.campaigns.length > 0 &&
      facts.campaigns.every((c) => c.objective === "LINK CLICKS")
        ? metric.key === "link_clicks"
          ? "results:"
          : metric.key === "cpc_link"
            ? "cpr:"
            : null
        : facts.campaigns.length === 1 &&
            facts.campaigns[0].objective === "REACH" &&
            metric.key === "reach"
          ? "results:"
          : null;
    return (
      !alias ||
      !cards.some(
        (card) =>
          card.key.startsWith(alias) &&
          (metric.current != null || metric.previous != null) &&
          card.current === metric.current &&
          card.previous === metric.previous,
      )
    );
  });
}
