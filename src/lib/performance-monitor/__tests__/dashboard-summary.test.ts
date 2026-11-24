import { describe, it, expect } from "vitest";
import {
  accountHighlightMetrics,
  campaignHighlightMetrics,
  duplicateAccountTotals,
  campaignComparisonMetrics,
  remainingAccountMetrics,
} from "../dashboard-metrics";
import { signalSummaryLine } from "../summary-line";
import type {
  CampaignPerformance,
  PeriodMetrics,
  PerformanceFacts,
} from "../facts";
const base: PeriodMetrics = {
  spend: 100,
  impressions: 10000,
  clicks: 200,
  cpc: 0.5,
  ctr: 2,
  results: 10,
  cpr: 10,
  landingPageViews: 40,
  linkClicks: 100,
  linkCpc: 1,
};
const campaign = (
  objective = "WEBSITE LEADS",
  costLabel = "Cost per website lead",
  current = base,
  previous = base,
): CampaignPerformance => ({
  id: "1",
  name: "A",
  objective,
  costLabel,
  current,
  previous,
  comparableResults: true,
  signals: [],
});
const facts = (campaigns: CampaignPerformance[]): PerformanceFacts => ({
  periodA: { startIso: "2026-11-17", endIso: "2026-11-23" },
  periodB: { startIso: "2026-11-10", endIso: "2026-11-16" },
  campaigns,
  current: { ...base, spend: 300 },
  previous: { ...base, spend: 200 },
  empty: false,
});
describe("goal-aware account highlights", () => {
  it("shows the requested lead highlights and weights same-goal cost including zero-result spend", () => {
    const cards = accountHighlightMetrics(
      facts([
        campaign(),
        {
          ...campaign("WEBSITE LEADS", "Cost per website lead", {
            ...base,
            spend: 200,
            results: 0,
            cpr: null,
          }),
          id: "2",
        },
      ]),
    );
    expect(cards.map((c) => c.label)).toEqual([
      "Amount spent",
      "Results · Website Leads",
      "Cost Per Website Lead",
      "Landing page views",
    ]);
    expect(cards[1].current).toBe(10);
    expect(cards[2].current).toBe(30);
  });
  it("keeps lead results and click results separate and uses only their own goal spend", () => {
    const cards = accountHighlightMetrics(
      facts([
        campaign(),
        {
          ...campaign("LINK CLICKS", "CPC (cost per link click)", {
            ...base,
            spend: 200,
            results: 400,
            cpr: 0.5,
          }),
          id: "2",
        },
      ]),
    );
    expect(
      cards.find((c) => c.label === "Results · Website Leads")?.current,
    ).toBe(10);
    expect(
      cards.find((c) => c.label === "Cost Per Website Lead")?.current,
    ).toBe(10);
    expect(
      cards.find((c) => c.label === "Results · Link Clicks")?.current,
    ).toBe(400);
    expect(
      cards.find((c) => c.label === "CPC (Cost Per Link Click)")?.current,
    ).toBe(0.5);
  });
  it("does not invent partial sums or sum unique reach across campaigns", () => {
    const cards = accountHighlightMetrics(
      facts([
        campaign(),
        {
          ...campaign("WEBSITE LEADS", "Cost per website lead", {
            ...base,
            results: null,
          }),
          id: "2",
        },
      ]),
    );
    expect(cards[1].current).toBeNull();
    expect(cards[2].current).toBeNull();
    const reach = accountHighlightMetrics(
      facts([
        campaign("REACH", "Cost per 1K reach"),
        { ...campaign("REACH", "Cost per 1K reach"), id: "2", name: "B" },
      ]),
    );
    expect(
      reach.filter((c) => c.key.startsWith("results:")).map((c) => c.label),
    ).toEqual(["Results · Reach · A", "Results · Reach · B"]);
  });
  it("removes repeated primary click/count cost aliases but retains different measures", () => {
    const c = campaign(
      "LINK CLICKS",
      "Cost per click",
      { ...base, results: 100, cpr: 1 },
      { ...base, results: 100, cpr: 1 },
    );
    const metrics = campaignComparisonMetrics(c);
    expect(metrics.filter((m) => m.key === "results")).toHaveLength(1);
    expect(
      metrics.some((m) => m.key === "link_clicks" || m.key === "cpc_link"),
    ).toBe(false);
    expect(metrics.some((m) => m.key === "clicks_all")).toBe(true);
    expect(metrics.some((m) => m.key === "landing_page_views")).toBe(true);
    const changed = { ...c, current: { ...c.current, results: 80, cpr: 1.25 } };
    expect(
      campaignComparisonMetrics(changed).some((m) => m.key === "link_clicks"),
    ).toBe(true);
    const f = facts([c]);
    expect(
      accountHighlightMetrics(f).some(
        (metric) => metric.label === "CPC (cost per link click)",
      ),
    ).toBe(true);
    f.current = { ...c.current };
    f.previous = { ...c.previous };
    expect(
      remainingAccountMetrics(f).some((m) =>
        ["spend", "link_clicks", "cpc_link"].includes(m.key),
      ),
    ).toBe(false);
  });
});
describe("short summary sentences", () => {
  it("explains outcome declines directly rather than repeating technical engine copy", () =>
    expect(
      signalSummaryLine(campaign(), {
        key: "results-down",
        metric: "WEBSITE LEADS",
        tone: "warning",
        change: -70,
        message: "Primary results declined despite broadly maintained spend.",
      }),
    ).toBe("Website Leads declined by 70% compared with the previous period."));
  it("gives a short optional creative suggestion for falling CTR", () =>
    expect(
      signalSummaryLine(campaign(), {
        key: "ctr-down",
        metric: "CTR (all)",
        tone: "warning",
        change: -50,
        message: "technical",
      }),
    ).toBe(
      "CTR (all) declined by 50% compared with the previous period. Consider refreshing the creatives.",
    ));
  it("does not mislabel target comparisons or invent missing percentages", () => {
    expect(
      signalSummaryLine(campaign(), {
        key: "cost-above-target",
        metric: "Cost per result",
        tone: "warning",
        change: 25,
        message: "technical",
      }),
    ).toContain("above the saved target");
    expect(
      signalSummaryLine(campaign(), {
        key: "roas-unavailable",
        metric: "ROAS",
        tone: "warning",
        change: null,
        message: "technical",
      }),
    ).toBe("Purchase ROAS is unavailable for this comparison.");
  });
});

describe("campaign highlights and duplicate account totals", () => {
  it("highlights spend, results, cost and landing page views for lead campaigns", () => {
    expect(campaignHighlightMetrics(campaign()).map((m) => m.key)).toEqual([
      "spend",
      "results",
      "cpr",
      "landing_page_views",
    ]);
  });
  it("highlights goal-specific purchases and ROAS and handles other goals", () => {
    expect(
      campaignHighlightMetrics(campaign("PURCHASES", "Cost per purchase")).map(
        (m) => m.key,
      ),
    ).toContain("roas");
    const video = campaignHighlightMetrics(
      campaign("VIDEO VIEWS", "Cost per video view"),
    );
    expect(video.find((m) => m.key === "results")?.label).toBe(
      "Results · Video Views",
    );
    expect(new Set(video.map((m) => m.key)).size).toBe(video.length);
  });
  it("collapses only one campaign with identical account delivery figures in both periods", () => {
    const f = {
      ...facts([campaign()]),
      current: { ...base },
      previous: { ...base },
    };
    expect(duplicateAccountTotals(f)).toBe(true);
    expect(
      duplicateAccountTotals({ ...f, campaigns: [campaign(), campaign()] }),
    ).toBe(false);
    expect(
      duplicateAccountTotals({ ...f, current: { ...base, spend: 101 } }),
    ).toBe(false);
    expect(
      duplicateAccountTotals({ ...f, previous: { ...base, reach: 776 } }),
    ).toBe(false);
    expect(duplicateAccountTotals({ ...f, campaigns: [] })).toBe(false);
  });
});
