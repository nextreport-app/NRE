import { describe, expect, it } from "vitest";
import {
  supplementalMetrics,
  enrichPerformanceMetrics,
} from "../supplemental-metrics";
import { parseCsvText } from "../../nre/parse-csv";
import { buildPerformanceFacts, readPerformanceSnapshot } from "../facts";
import {
  deliveryMetrics,
  comparisonCampaignState,
  additionalMetrics,
  outcomeMetrics,
} from "../dashboard-metrics";
const config = { metaAdAccountId: "123", currency: "USD", timezone: "UTC" };
const now = new Date("2026-11-20T12:00Z");
function fixture() {
  const parsed = parseCsvText(
    "Campaign name,Campaign ID,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all),Link clicks\nLeads,456,2026-11-19,100,10,On-Facebook leads,10000,100,50\nLeads,456,2026-11-12,100,20,On-Facebook leads,10000,100,25",
  );
  return buildPerformanceFacts(parsed.rows, parsed.headers, config, now);
}
describe("supplementary period evidence", () => {
  it("selects one action alias instead of adding overlapping totals", () => {
    const result = supplementalMetrics({
      spend: "100",
      reach: "900",
      inline_link_clicks: "50",
      actions: [
        { action_type: "omni_purchase", value: "5" },
        { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
        { action_type: "landing_page_view", value: "25" },
        { action_type: "omni_add_to_cart", value: "12" },
        { action_type: "omni_initiated_checkout", value: "7" },
      ],
    });
    expect(result).toMatchObject({
      reach: 900,
      linkClicks: 50,
      linkCpc: 2,
      purchases: 5,
      purchaseCost: 20,
      landingPageViews: 25,
      landingPageCost: 4,
      addToCart: 12,
      initiateCheckout: 7,
      metaLeads: null,
    });
  });
  it("does not turn absent or invalid actions into zero, or divide by zero", () => {
    expect(supplementalMetrics({ spend: "100", actions: [] })).toMatchObject({
      purchases: null,
      addToCart: null,
      landingPageViews: null,
    });
    expect(
      supplementalMetrics({
        spend: "100",
        inline_link_clicks: "0",
        actions: [{ action_type: "landing_page_view", value: "0" }],
      }),
    ).toMatchObject({
      linkClicks: 0,
      linkCpc: null,
      landingPageViews: 0,
      landingPageCost: null,
    });
    expect(
      supplementalMetrics({
        reach: "-1",
        actions: [
          { action_type: "landing_page_view", value: "4" },
          { action_type: "landing_page_view", value: "5" },
        ],
      }),
    ).toMatchObject({ reach: null, landingPageViews: null });
  });
  it("uses unique account-period reach rather than summing campaigns/days", () => {
    const facts = fixture();
    enrichPerformanceMetrics(facts, {
      currentAccount: [
        { date_start: "2026-11-13", date_stop: "2026-11-19", reach: "800" },
      ],
      currentCampaigns: [
        {
          campaign_id: "456",
          date_start: "2026-11-13",
          date_stop: "2026-11-19",
          reach: "600",
        },
      ],
    });
    expect(facts.current.reach).toBe(800);
    expect(facts.campaigns[0].current.reach).toBe(600);
    expect(facts.previous.reach).toBeUndefined();
  });
  it("rejects duplicate campaign evidence and mismatched dates", () => {
    const facts = fixture(),
      row = {
        campaign_id: "456",
        date_start: "2026-11-13",
        date_stop: "2026-11-19",
        reach: "600",
      };
    enrichPerformanceMetrics(facts, {
      currentCampaigns: [row, row],
      currentAccount: [{ ...row, date_stop: "2026-11-18" }],
    });
    expect(facts.campaigns[0].current.reach).toBeUndefined();
    expect(facts.current.reach).toBeUndefined();
  });
  it("keeps link clicks distinct from all clicks and persists optional metrics in snapshots", () => {
    const facts = fixture();
    expect(facts.current).toMatchObject({
      clicks: 100,
      cpc: 1,
      linkClicks: 50,
      linkCpc: 2,
    });
    facts.current.reach = 800;
    facts.campaigns[0].current.addToCart = 9;
    const snapshot = readPerformanceSnapshot(
      JSON.stringify({
        version: 2,
        config,
        checkedAt: now.toISOString(),
        facts,
      }),
      config,
      now,
    );
    expect(snapshot?.facts?.current.reach).toBe(800);
    expect(snapshot?.facts?.campaigns[0].current.addToCart).toBe(9);
  });
  it("keeps primary goal metrics dynamic for video, apps and other outcomes", () => {
    const c = fixture().campaigns[0];
    for (const objective of ["VIDEO VIEWS", "APP INSTALLS", "CUSTOM EVENT"]) {
      expect(outcomeMetrics({ ...c, objective })[0]).toMatchObject({
        key: "results",
        label: expect.stringContaining(
          objective
            .toLowerCase()
            .split(" ")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
        ),
      });
    }
    expect(
      deliveryMetrics(c.current, c.previous).find((m) => m.key === "cpc_link"),
    ).toMatchObject({ current: 2, previous: 4 });
    expect(
      additionalMetrics({
        ...c,
        current: { ...c.current, addToCart: 12, initiateCheckout: 5 },
      }).map((m) => m.label),
    ).toContain("Initiate checkout");
  });
});
it("corrects Reach goal results with unique period reach and suppresses missing baselines", () => {
  const facts = fixture(),
    campaign = facts.campaigns[0];
  campaign.objective = "REACH";
  campaign.costLabel = "Cost per 1K reach";
  enrichPerformanceMetrics(facts, {
    currentCampaigns: [
      {
        campaign_id: "456",
        date_start: facts.periodA.startIso,
        date_stop: facts.periodA.endIso,
        reach: "800",
      },
    ],
    previousCampaigns: [
      {
        campaign_id: "456",
        date_start: facts.periodB.startIso,
        date_stop: facts.periodB.endIso,
        reach: "1000",
      },
    ],
  });
  expect(campaign.current).toMatchObject({
    results: 800,
    cpr: 125,
    linkClicks: 50,
  });
  expect(campaign.previous).toMatchObject({ results: 1000, cpr: 100 });
  expect(campaign.comparableResults).toBe(true);
  const missing = fixture();
  missing.campaigns[0].objective = "REACH";
  enrichPerformanceMetrics(missing, {});
  expect(missing.campaigns[0].current.results).toBeNull();
  expect(missing.campaigns[0].comparableResults).toBe(false);
});
it("detects actual app and video result labels through the shared comparison report pipeline", () => {
  for (const [resultType, goal] of [
    ["App installs", "APP INSTALLS"],
    ["Video views", "VIDEO VIEWS"],
  ]) {
    const parsed = parseCsvText(
      `Campaign name,Day,Amount spent (USD),Results,Result type,Impressions,Clicks (all)\nA,2026-11-19,100,20,${resultType},10000,100\nA,2026-11-12,100,10,${resultType},10000,100`,
    );
    const facts = buildPerformanceFacts(
      parsed.rows,
      parsed.headers,
      config,
      now,
    );
    expect(facts.campaigns[0]).toMatchObject({
      objective: goal,
      current: { results: 20, cpr: 5 },
      previous: { results: 10, cpr: 10 },
      comparableResults: true,
    });
  }
});

it("keeps supporting warnings visible when an efficiency target is also met", () => {
  const campaign = fixture().campaigns[0];
  campaign.signals = [
    {
      key: "ctr-down",
      metric: "CTR (all)",
      change: -30,
      tone: "warning",
      role: "supporting",
      message: "Click response declined",
    },
    {
      key: "target-met",
      metric: "Campaign target",
      change: null,
      tone: "positive",
      role: "primary",
      message: "Target met",
    },
  ];
  expect(comparisonCampaignState(campaign)).toBe("review");
});
