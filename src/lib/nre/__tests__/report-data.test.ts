import { describe, expect, it, beforeAll } from "vitest";
import { buildReportData } from "../report-data";
import type { NreRow } from "../columns";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-07-20T12:00:00Z"); // "today" — 13-19 July is the trailing 7-day window

function daysInclusive(startDay: number, endDay: number): string[] {
  const days: string[] = [];
  for (let d = startDay; d <= endDay; d++) days.push(`${String(d).padStart(2, "0")}-07-2026`);
  return days;
}

function buildDailyRows(config: {
  campaign_name: string;
  ad_set_name: string;
  result_type: string;
  spend: number;
  reach: number;
  impressions: number;
  results: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  frequency: number;
}): NreRow[] {
  return daysInclusive(13, 19).map((day) => ({
    _raw: { Day: day },
    campaign_name: config.campaign_name,
    ad_set_name: config.ad_set_name,
    result_type: config.result_type,
    spend: String(config.spend),
    reach: String(config.reach),
    impressions: String(config.impressions),
    results: String(config.results),
    link_clicks: String(config.link_clicks),
    ctr: String(config.ctr),
    cpc: String(config.cpc),
    frequency: String(config.frequency),
    date_start: day,
    date_end: day,
  }));
}

// Multi-ad-set purchase campaign
const prospecting = buildDailyRows({
  campaign_name: "Shoes - Purchases",
  ad_set_name: "Prospecting",
  result_type: "Purchase",
  spend: 100,
  reach: 1000,
  impressions: 3000,
  results: 2,
  link_clicks: 50,
  ctr: 1.5,
  cpc: 3,
  frequency: 3,
});
const retargeting = buildDailyRows({
  campaign_name: "Shoes - Purchases",
  ad_set_name: "Retargeting",
  result_type: "Purchase",
  spend: 50,
  reach: 800,
  impressions: 2000,
  results: 1,
  link_clicks: 30,
  ctr: 2.5,
  cpc: 4,
  frequency: 2,
});
// Single-ad-set awareness campaign — a genuine (uncorrected) Reach objective:
// link_clicks stays 0 so the Reach-as-proxy correction never triggers.
const awareness = buildDailyRows({
  campaign_name: "Brand - Reach",
  ad_set_name: "Awareness",
  result_type: "Reach",
  spend: 200,
  reach: 10000,
  impressions: 15000,
  results: 0,
  link_clicks: 0,
  ctr: 0.8,
  cpc: 0,
  frequency: 1.5,
});

const mtdDailyRows = [...prospecting, ...retargeting, ...awareness];

describe("buildReportData — multi-campaign integration", () => {
  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: 100000,
    mtdDailyRows,
    now: NOW,
  });

  it("is not paused and computes the global week date range", () => {
    expect(data.isPaused).toBe(false);
    expect(data.cover.dateRange).toBe("Jul 13 - Jul 19");
    expect(data.fileDateRange).toBe("07/13/2026 to 07/19/2026");
  });

  it("formats the report date in the client's timezone", () => {
    expect(data.cover.reportDate).toBe("07-20-2026");
  });

  it("builds one campaign summary slide per campaign, in default-sorted order", () => {
    expect(data.campaignSlides.map((s) => s.campaignName)).toEqual([
      "Brand - Reach",
      "Shoes - Purchases",
    ]);
  });

  it("only builds ad-set slides for the multi-ad-set campaign", () => {
    expect(data.adSetSlides.map((s) => `${s.campaignName} / ${s.adSetName}`)).toEqual([
      "Shoes - Purchases / Prospecting",
      "Shoes - Purchases / Retargeting",
    ]);
  });

  it("computes correct campaign summary metrics for the purchases campaign", () => {
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    expect(shoes.resultLabel).toBe("PURCHASES");
    expect(shoes.metrics).toEqual({
      spend: "₹1,050",
      reach: "12,600",
      impressions: "35,000",
      results: "21",
      ctr: "2.00%",
      cpr: "₹50.00",
      cpc: "₹3.50",
    });
    expect(shoes.dateRangeLine).toBe("Jul 13 - Jul 19\nFreq: 2.5x avg");
  });

  it("computes cost-per-1K-reach directly from reach for a reach campaign summary with 0 results", () => {
    // spend 1400, reach 70000 → (1400 * 1000) / 70000 = 20.00
    const brand = data.campaignSlides.find((s) => s.campaignName === "Brand - Reach")!;
    expect(brand.resultLabel).toBe("REACH");
    expect(brand.metrics).toEqual({
      spend: "₹1,400",
      reach: "70,000",
      impressions: "105,000",
      results: "0",
      ctr: "0.80%",
      cpr: "₹20.00",
      cpc: "—",
    });
  });

  it("computes correct per-ad-set metrics", () => {
    const prospectingSlide = data.adSetSlides.find((s) => s.adSetName === "Prospecting")!;
    expect(prospectingSlide.metrics).toEqual({
      spend: "₹700",
      reach: "7,000",
      impressions: "21,000",
      results: "14",
      ctr: "1.50%",
      cpr: "₹50.00",
      cpc: "₹3.00",
    });

    const retargetingSlide = data.adSetSlides.find((s) => s.adSetName === "Retargeting")!;
    expect(retargetingSlide.metrics.spend).toBe("₹350");
    expect(retargetingSlide.metrics.results).toBe("7");
  });

  it("computes the account health score and badge", () => {
    // results>0 (25) + avgCtr 1.6 in [1.0,2.0) (13) + avgFreq 2.17 in [2.0,2.5) (17) + cost-neutral (12) = 67
    expect(data.cover.healthScore).toBe(67);
    expect(data.cover.healthBadge).toContain("On Track");
  });

  it("computes the budget summary line", () => {
    expect(data.cover.budgetSummary).toBe(
      "Monthly Budget: ₹2,450 of ₹100,000 used (2.5%) — 11 days remaining",
    );
  });

  it("builds the MTD chart with default-sorted campaign order", () => {
    expect(data.chart).not.toBeNull();
    expect(data.chart!.campaigns.map((c) => c.name)).toEqual(["Brand - Reach", "Shoes - Purchases"]);
    expect(data.chart!.totalAllSpend).toBe(2450);
    expect(data.chart!.activeCampaignCount).toBe(2);

    const shoesChart = data.chart!.campaigns.find((c) => c.name === "Shoes - Purchases")!;
    expect(shoesChart.spend).toBe(1050);
    expect(shoesChart.results).toBe(21);
    expect(shoesChart.cpr).toBeCloseTo(50);
    expect(shoesChart.resLabel).toBe("PURCHASES");
  });

  it("leaves the period row empty when no Period CSV was uploaded", () => {
    expect(data.periodRow.hasData).toBe(false);
    expect(data.periodRow.monthLabel).toBe("—");
  });

  it("computes the MTD row and derives table header labels from it", () => {
    expect(data.mtdRow).toMatchObject({
      hasData: true,
      monthLabel: "Jul 13 - Jul 19",
      spend: "₹2,450",
      // Never a summed daily reach total — see the dedicated reach test below.
      reach: "—",
      impressions: "140,000",
      ctr: "1.60%",
      cpc: "₹3.50",
      result1: "21",
      cpr1: "₹50.00",
      result2: "—",
      cpr2: "—",
    });
    expect(data.tableHeaderLabels).toEqual({
      result1Label: "PURCHASES",
      cpr1Label: "COST PER PURCHASE",
      result2Label: "—",
      cpr2Label: "—",
    });
  });

  it("never sums daily reach in the MTD row — reach de-dupes people, so summing per-day totals wildly overcounts", () => {
    // Regression test for the exact scenario reported: daily CSV reach summed
    // to 90,779 while the account's actual (Meta-deduplicated) reach was
    // 46,266 — any positive summed total would be wrong, so the MTD row must
    // always show "—" for reach regardless of what the daily rows total to.
    expect(data.mtdRow.reach).toBe("—");
  });
});

describe("buildReportData — paused account", () => {
  it("returns isPaused with a paused message and no slides", () => {
    const data = buildReportData({
      accountName: "Idle Co",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: [],
      now: NOW,
    });
    expect(data.isPaused).toBe(true);
    expect(data.campaignSlides).toEqual([]);
    expect(data.adSetSlides).toEqual([]);
    expect(data.chart).toBeNull();
    expect(data.pausedMessage).toContain("Idle Co");
    expect(data.cover.healthBadge).toBe("⚙️ Campaigns Paused");
    expect(data.cover.budgetSummary).toBe("");
  });

  it("still shows real Period CSV data even when the current month is paused", () => {
    // A paused current month doesn't imply last month (uploaded separately,
    // once, as the Period CSV) has no data — the source computes the period
    // row unconditionally, independent of the current month's pause state.
    const periodRows = [
      {
        _raw: {},
        campaign_name: "Shoes",
        result_type: "Purchase",
        spend: "500",
        reach: "2000",
        impressions: "4000",
        results: "10",
        ctr: "2",
        cpc: "3",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];
    const data = buildReportData({
      accountName: "Idle Co",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: [],
      periodRows,
      now: NOW,
    });
    expect(data.isPaused).toBe(true);
    expect(data.periodRow.hasData).toBe(true);
    expect(data.periodRow.spend).toBe("$500");
    expect(data.periodRow.result1).toBe("10");
    expect(data.mtdRow.hasData).toBe(false);
    // MTD is empty, so header labels fall back to the period row's groups.
    expect(data.tableHeaderLabels.result1Label).toBe("PURCHASES");
  });
});

describe("buildReportData — Leads (form) + Website subscriptions campaigns", () => {
  // Regression test for the exact real-account scenario reported: a "Leads
  // (form)" campaign and a "Website subscriptions" campaign must show their
  // real objective names everywhere — campaign slides, the Combined Total
  // table's column headers, and the MTD chart slide — never a generic
  // "RESULTS"/"CPR" bucket label.
  const leadsForm = buildDailyRows({
    campaign_name: "Lead Gen",
    ad_set_name: "Ad Set 1",
    result_type: "Leads (form)",
    spend: 100,
    reach: 4000,
    impressions: 8000,
    results: 6,
    link_clicks: 40,
    ctr: 1.2,
    cpc: 2.5,
    frequency: 1.8,
  });
  const websiteSubs = buildDailyRows({
    campaign_name: "Subscriptions",
    ad_set_name: "Ad Set 1",
    result_type: "Website subscriptions",
    spend: 80,
    reach: 3000,
    impressions: 6000,
    results: 5,
    link_clicks: 20,
    ctr: 1.0,
    cpc: 2.0,
    frequency: 1.5,
  });

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: null,
    mtdDailyRows: [...leadsForm, ...websiteSubs],
    now: NOW,
  });

  it("shows the real objective name (not a generic bucket) on each campaign's summary slide", () => {
    const leadSlide = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    expect(leadSlide.resultLabel).toBe("LEADS (FORM)");
    expect(leadSlide.costLabel).toBe("COST PER LEAD");

    const subsSlide = data.campaignSlides.find((s) => s.campaignName === "Subscriptions")!;
    expect(subsSlide.resultLabel).toBe("WEBSITE SUBSCRIPTIONS");
    expect(subsSlide.costLabel).toBe("COST PER SUBSCRIPTION");
  });

  it("shows the real objective name on the MTD chart slide, never the generic word RESULTS", () => {
    const leadChart = data.chart!.campaigns.find((c) => c.name === "Lead Gen")!;
    expect(leadChart.resLabel).toBe("LEADS (FORM)");
    expect(leadChart.cprLabel).toBe("COST PER LEAD");

    const subsChart = data.chart!.campaigns.find((c) => c.name === "Subscriptions")!;
    expect(subsChart.resLabel).toBe("WEBSITE SUBSCRIPTIONS");
    expect(subsChart.cprLabel).toBe("COST PER SUBSCRIPTION");
  });

  it("uses the real objective names as the Combined Total table's column headers", () => {
    // Leads (form) has more results (42) than Website subscriptions (35), so
    // it's group 1 (columns 7-8) and subscriptions is group 2 (columns 9-10).
    expect(data.tableHeaderLabels).toEqual({
      result1Label: "LEADS (FORM)",
      cpr1Label: "COST PER LEAD",
      result2Label: "WEBSITE SUBSCRIPTIONS",
      cpr2Label: "COST PER SUBSCRIPTION",
    });
  });

  it("never sums daily reach in the MTD row for this scenario either", () => {
    expect(data.mtdRow.reach).toBe("—");
  });
});
