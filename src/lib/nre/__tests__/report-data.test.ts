import { describe, expect, it, beforeAll } from "vitest";
import {
  buildCombinedTotalTableGrid,
  buildComparisonReportData,
  buildReportData,
  COMBINED_TOTAL_STATIC_HEADERS,
  type TableHeaderLabels,
  type TableRowData,
} from "../report-data";
import { adSetKey } from "../ad-sets";
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
    expect(data.cover.dateRange).toBe("July 13 - July 19");
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
    expect(shoes.dateRangeLine).toBe("July 13 - July 19\nAd Frequency: 2.5x avg");
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

  it("carries the raw numeric spend through ai.spendNum, alongside the formatted display string — generate-insights.ts's zero-spend check needs a number, not '₹1,050'", () => {
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    expect(shoes.ai.spendNum).toBe(1050);
    const brand = data.campaignSlides.find((s) => s.campaignName === "Brand - Reach")!;
    expect(brand.ai.spendNum).toBe(1400);

    const prospectingSlide = data.adSetSlides.find((s) => s.adSetName === "Prospecting")!;
    expect(prospectingSlide.ai.spendNum).toBe(700);
    const retargetingSlide2 = data.adSetSlides.find((s) => s.adSetName === "Retargeting")!;
    expect(retargetingSlide2.ai.spendNum).toBe(350);
  });

  it("computes the account health score and badge", () => {
    // results>0 (25) + avgCtr 1.6 in [1.0,2.0) (13) + avgFreq 2.17 in [2.0,2.5) (17) + cost-neutral (12) = 67
    expect(data.cover.healthScore).toBe(67);
    expect(data.cover.healthBadge).toContain("On Track");
  });

  it("computes the budget summary line", () => {
    // Fix 6 — whole-number percentage, no decimal place.
    expect(data.cover.budgetSummary).toBe(
      "Monthly Ad Budget: ₹2,450 of ₹100,000 used (2%) — 11 days remaining",
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

  it("leaves the period row empty when no Previous Month Data was uploaded", () => {
    expect(data.periodRow.hasData).toBe(false);
    expect(data.periodRow.monthLabel).toBe("—");
  });

  it("computes the MTD row and derives table header labels from it", () => {
    // Two distinct objectives across this fixture's 3 campaigns: Purchases
    // (Shoes campaign) and Reach (Brand campaign) — both get their own
    // column now (Fix 1: Reach is no longer excluded just because another
    // objective also exists), Purchases first since it has far more results.
    expect(data.mtdRow).toMatchObject({
      hasData: true,
      // Fix 3 — just the plain date range: no "MTD" suffix, no year (the
      // chart slide's own sub-line still gets the year, computed
      // separately — see buildReportData's periodSubLabel).
      monthLabel: "July 13 - July 19",
      spend: "₹2,450",
      // A straight sum of the daily rows' reach — see the dedicated reach test below.
      reach: "82,600",
      impressions: "140,000",
      ctr: "1.60%",
      cpc: "₹3.50",
      resultColumns: [
        { label: "PURCHASES", costLabel: "COST PER PURCHASE", value: "21", cprValue: "₹50.00" },
        { label: "REACH", costLabel: "COST PER 1K REACH", value: "0", cprValue: "₹20.00" },
      ],
    });
    expect(data.tableHeaderLabels).toEqual({
      resultColumns: [
        { label: "PURCHASES", costLabel: "COST PER PURCHASE" },
        { label: "REACH", costLabel: "COST PER 1K REACH" },
      ],
    });
  });

  it("sums daily reach in the MTD row — a known approximation (Meta may recount a person across days), matching what other reporting tools show", () => {
    // prospecting 1000/day + retargeting 800/day + awareness 10000/day, x7 days = 82,600.
    expect(data.mtdRow.reach).toBe("82,600");
  });
});

describe("buildReportData — ad set filtering (report upload wizard's Ad Sets step)", () => {
  // "Shoes - Purchases" has two ad sets (Prospecting, Retargeting); "Brand -
  // Reach" has one (Awareness) — mirrors the multi-campaign fixture above.
  it("removes excluded ad-set rows before the NRE engine runs — they never reach aggregation, results, or the chart", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      selectedAdSets: [adSetKey("Shoes - Purchases", "Prospecting"), adSetKey("Brand - Reach", "Awareness")],
      now: NOW,
    });

    // Retargeting's rows are gone entirely — not blanked, not zeroed,
    // absent. Shoes now has only one surviving ad set (Prospecting), so per
    // the existing "2+ ad sets get their own slide" rule it no longer gets
    // a dedicated ad-set slide — its campaign summary slide covers it.
    expect(data.adSetSlides.some((s) => s.adSetName === "Retargeting")).toBe(false);
    // Shoes' campaign summary only reflects the surviving ad set's numbers
    // (spend 700, not the combined 1,050 from both ad sets).
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    expect(shoes.metrics.spend).toBe("₹700");
    expect(data.chart!.campaigns.find((c) => c.name === "Shoes - Purchases")!.spend).toBe(700);
  });

  it("deselecting every ad set in a campaign removes that campaign from the report entirely", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      // Both of Shoes' ad sets excluded; Brand's one ad set stays selected.
      selectedAdSets: [adSetKey("Brand - Reach", "Awareness")],
      now: NOW,
    });

    expect(data.campaignSlides.map((s) => s.campaignName)).toEqual(["Brand - Reach"]);
    expect(data.adSetSlides).toEqual([]);
    expect(data.chart!.campaigns.map((c) => c.name)).toEqual(["Brand - Reach"]);
    // The account isn't paused overall — Brand - Reach still has real data,
    // only the fully-deselected campaign disappears.
    expect(data.isPaused).toBe(false);
  });

  it("null selectedAdSets (no selection made) behaves exactly like before the feature existed — nothing filtered", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      selectedAdSets: null,
      now: NOW,
    });
    expect(data.campaignSlides.map((s) => s.campaignName)).toEqual(["Brand - Reach", "Shoes - Purchases"]);
    expect(data.adSetSlides).toHaveLength(2);
  });

  // Regression: Previous Month Data (previous full month, optional second
  // upload) fed straight into the table slide's "Period" row without ever
  // going through filterRowsByCampaigns/filterRowsByAdSets — a deselected
  // ad set's spend still reached the report via that row even though the
  // MTD row correctly excluded it.
  it("also applies ad-set/campaign selection to Previous Month Data, not just the MTD Daily CSV", () => {
    const periodRows = [
      {
        _raw: {},
        campaign_name: "Shoes - Purchases",
        ad_set_name: "Prospecting",
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
      {
        _raw: {},
        campaign_name: "Shoes - Purchases",
        ad_set_name: "Retargeting",
        result_type: "Purchase",
        spend: "300",
        reach: "1000",
        impressions: "2000",
        results: "5",
        ctr: "1.5",
        cpc: "2",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows,
      // Only Prospecting selected — Retargeting's $300 must vanish from the
      // Period row exactly as it already does from the MTD row.
      selectedAdSets: [adSetKey("Shoes - Purchases", "Prospecting"), adSetKey("Brand - Reach", "Awareness")],
      now: NOW,
    });

    expect(data.periodRow.spend).toBe("$500");
    expect(data.periodRow.resultColumns.find((c) => c.label === "PURCHASES")?.value).toBe("10");
  });

  it("deselecting an entire campaign also removes its Previous Month Data rows", () => {
    const periodRows = [
      {
        _raw: {},
        campaign_name: "Brand - Reach",
        ad_set_name: "Awareness",
        result_type: "Reach",
        spend: "900",
        reach: "5000",
        impressions: "8000",
        results: "0",
        ctr: "0.5",
        cpc: "0",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows,
      selectedCampaigns: ["Shoes - Purchases"], // Brand - Reach excluded entirely
      now: NOW,
    });

    expect(data.periodRow.hasData).toBe(false);
  });
});

describe("buildReportData — Combined Total row labels and same-month note (Fixes 1-3)", () => {
  const junePeriodRows = [
    {
      _raw: {},
      campaign_name: "Shoes - Purchases",
      ad_set_name: "Prospecting",
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

  const julyPeriodRows = [
    {
      _raw: {},
      campaign_name: "Shoes - Purchases",
      ad_set_name: "Prospecting",
      result_type: "Purchase",
      spend: "500",
      reach: "2000",
      impressions: "4000",
      results: "10",
      ctr: "2",
      cpc: "3",
      date_start: "01-07-2026",
      date_end: "19-07-2026",
    },
  ];

  it("labels the Previous Month row as a compact same-month range (Fix 3), no prefix and no year", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: junePeriodRows,
      now: NOW,
    });
    expect(data.periodRow.monthLabel).toBe("June 1 - 30");
    expect(data.periodRow.monthName).toBe("June");
  });

  it("sameMonthAsCurrentMTD is false when the Previous Month row and MTD row fall in different calendar months", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows, // July 13-19, 2026
      periodRows: junePeriodRows, // June 2026
      now: NOW,
    });
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(false);
  });

  it("sameMonthAsCurrentMTD is true on the Previous Month row when both rows fall in the same calendar month", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows, // July 13-19, 2026
      periodRows: julyPeriodRows, // also July 2026
      now: NOW,
    });
    expect(data.periodRow.monthName).toBe("July");
    expect(data.mtdRow.monthName).toBe("July");
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(true);
    // Meaningless on the MTD row itself — always false there.
    expect(data.mtdRow.sameMonthAsCurrentMTD).toBe(false);
  });

  it("sameMonthAsCurrentMTD is false when there's no Previous Month Data at all — not (wrongly) 'same month' via null === null", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      now: NOW, // no periodRows passed
    });
    expect(data.periodRow.hasData).toBe(false);
    expect(data.periodRow.monthName).toBeNull();
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(false);
  });

  it("sameMonthAsCurrentMTD is still computed as true on a Monthly report in the same-month case — it's a pure data fact, independent of reportType (the render layer decides what to do with it)", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: julyPeriodRows,
      reportType: "MONTHLY",
      now: NOW,
    });
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(true);
  });
});

describe("buildReportData — objectiveWarnings (upload preview's 'objective auto-detected' warning)", () => {
  it("flags a campaign whose objective could only be resolved via the low-confidence data-value fallback", () => {
    // Empty result_type, no recognizable objective column in the fixture's
    // _raw (only "Day" — see buildDailyRows), reach non-zero and different
    // from results, link clicks present → Step 3's LINK CLICKS fallback.
    const rows = buildDailyRows({
      campaign_name: "Mystery Campaign",
      ad_set_name: "Ad Set 1",
      result_type: "",
      spend: 100,
      reach: 1000,
      impressions: 3000,
      results: 0,
      link_clicks: 50,
      ctr: 1.5,
      cpc: 3,
      frequency: 2,
    });
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    expect(data.objectiveWarnings).toEqual([
      { campaignName: "Mystery Campaign", detectedLabel: "LINK CLICKS" },
    ]);
  });

  it("does not flag a campaign whose objective came from result_type text (Step 1 — confident)", () => {
    const rows = buildDailyRows({
      campaign_name: "Shoes - Purchases",
      ad_set_name: "Ad Set 1",
      result_type: "Purchase",
      spend: 100,
      reach: 1000,
      impressions: 3000,
      results: 5,
      link_clicks: 50,
      ctr: 1.5,
      cpc: 3,
      frequency: 2,
    });
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    expect(data.objectiveWarnings).toEqual([]);
  });

  it("is empty for a paused account", () => {
    const data = buildReportData({
      accountName: "Idle Co",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: [],
      now: NOW,
    });
    expect(data.objectiveWarnings).toEqual([]);
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

  it("still shows real Previous Month Data even when the current month is paused", () => {
    // A paused current month doesn't imply last month (uploaded separately,
    // once, as Previous Month Data) has no data — the source computes the period
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
    expect(data.periodRow.resultColumns).toEqual([
      { label: "PURCHASES", costLabel: "COST PER PURCHASE", value: "10", cprValue: "$50.00" },
    ]);
    // Only the MTD row gets the " MTD" suffix — the Period row is a
    // completed month, not a partial in-progress one.
    expect(data.periodRow.monthLabel).not.toContain("MTD");
    expect(data.mtdRow.hasData).toBe(false);
    // MTD is empty, so header labels fall back to the period row's groups.
    expect(data.tableHeaderLabels.resultColumns[0].label).toBe("PURCHASES");
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
    expect(leadSlide.resultLabel).toBe("META FORM LEADS");
    expect(leadSlide.costLabel).toBe("COST PER LEAD");

    const subsSlide = data.campaignSlides.find((s) => s.campaignName === "Subscriptions")!;
    expect(subsSlide.resultLabel).toBe("SUBSCRIPTIONS");
    expect(subsSlide.costLabel).toBe("COST PER SUBSCRIPTION");
  });

  it("shows the real objective name on the MTD chart slide, never the generic word RESULTS", () => {
    const leadChart = data.chart!.campaigns.find((c) => c.name === "Lead Gen")!;
    expect(leadChart.resLabel).toBe("META FORM LEADS");
    expect(leadChart.cprLabel).toBe("COST PER LEAD");

    const subsChart = data.chart!.campaigns.find((c) => c.name === "Subscriptions")!;
    expect(subsChart.resLabel).toBe("SUBSCRIPTIONS");
    expect(subsChart.cprLabel).toBe("COST PER SUBSCRIPTION");
  });

  it("uses the real objective names as the Combined Total table's column headers", () => {
    // Leads (form) has more results (42) than Website subscriptions (35), so
    // it's the first result-column pair and subscriptions is the second.
    expect(data.tableHeaderLabels).toEqual({
      resultColumns: [
        { label: "META FORM LEADS", costLabel: "COST PER LEAD" },
        { label: "SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION" },
      ],
    });
  });

  it("sums daily reach in the MTD row for this scenario too", () => {
    // leadsForm 4000/day + websiteSubs 3000/day, x7 days = 49,000.
    expect(data.mtdRow.reach).toBe("49,000");
  });
});

describe("buildCombinedTotalTableGrid", () => {
  function resultCol(label: string, costLabel: string, value = "20", cprValue = "₹50.00") {
    return { label, costLabel, value, cprValue };
  }

  function tableRow(overrides: Partial<TableRowData> = {}): TableRowData {
    return {
      hasData: true,
      monthLabel: "Jul 1 - Jul 23",
      monthName: "July",
      sameMonthAsCurrentMTD: false,
      spend: "₹1,000",
      reach: "5,000",
      impressions: "10,000",
      ctr: "1.50%",
      cpc: "₹2.00",
      resultColumns: [resultCol("RESULTS", "COST PER RESULT")],
      ...overrides,
    };
  }

  const oneObjectiveHeaders: TableHeaderLabels = {
    resultColumns: [{ label: "QUOTE REQUESTS", costLabel: "COST PER QUOTE REQUEST" }],
  };

  it("is exactly 3 rows by 8 columns for a single objective (6 static + 1 pair)", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), oneObjectiveHeaders);
    expect(grid).toHaveLength(3);
    for (const row of grid) expect(row).toHaveLength(8);
  });

  it("row 0 is the header row: 6 static labels then the objective's own label pair", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), oneObjectiveHeaders);
    expect(grid[0]).toEqual([...COMBINED_TOTAL_STATIC_HEADERS, "QUOTE REQUESTS", "COST PER QUOTE REQUEST"]);
  });

  // Reach column (index 2) — the grid builder just carries whatever
  // computeTableRow gave it straight through; both rows now get a real
  // summed number (see computeTableRow's own reach tests for the sum logic).
  it("column 2 (Reach): carries the Period and MTD row's own reach values through unchanged", () => {
    const periodRow = tableRow({ reach: "46,266" });
    const mtdRow = tableRow({ reach: "90,779" });
    const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, oneObjectiveHeaders);
    expect(grid[0][2]).toBe("Reach"); // header never disappears
    expect(grid[1][2]).toBe("46,266"); // Period row
    expect(grid[2][2]).toBe("90,779"); // MTD row
  });

  it("dynamic result columns show the actual objective names, never generic 'Results'/'CPR'", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), oneObjectiveHeaders);
    expect(grid[0][6]).toBe("QUOTE REQUESTS");
    expect(grid[0][7]).toBe("COST PER QUOTE REQUEST");
    expect(grid[0][6]).not.toBe("Results");
    expect(grid[0][7]).not.toBe("CPR");
  });

  it("shows the real second objective's labels when a row has two", () => {
    const twoObjectiveHeaders: TableHeaderLabels = {
      resultColumns: [
        { label: "LEADS (FORM)", costLabel: "COST PER LEAD" },
        { label: "WEBSITE SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION" },
      ],
    };
    const row = tableRow({
      resultColumns: [resultCol("LEADS (FORM)", "COST PER LEAD"), resultCol("WEBSITE SUBSCRIPTIONS", "COST PER SUBSCRIPTION")],
    });
    const grid = buildCombinedTotalTableGrid(row, row, twoObjectiveHeaders);
    expect(grid[0][8]).toBe("WEBSITE SUBSCRIPTIONS");
    expect(grid[0][9]).toBe("COST PER SUBSCRIPTION");
  });

  // Fix 1: no objective should ever be dropped, however many are running.
  it("grows to 12 columns for 3 objectives and 14 for 4, never dropping one", () => {
    const threeHeaders: TableHeaderLabels = {
      resultColumns: [
        { label: "LINK CLICKS", costLabel: "COST PER CLICK" },
        { label: "META FORM LEADS", costLabel: "COST PER LEAD" },
        { label: "REACH", costLabel: "COST PER 1K REACH" },
      ],
    };
    const threeRow = tableRow({
      resultColumns: [
        resultCol("LINK CLICKS", "COST PER CLICK"),
        resultCol("META FORM LEADS", "COST PER LEAD"),
        resultCol("REACH", "COST PER 1K REACH"),
      ],
    });
    const threeGrid = buildCombinedTotalTableGrid(threeRow, threeRow, threeHeaders);
    expect(threeGrid[0]).toHaveLength(12);
    expect(threeGrid[0]).toEqual([...COMBINED_TOTAL_STATIC_HEADERS, "LINK CLICKS", "COST PER CLICK", "META FORM LEADS", "COST PER LEAD", "REACH", "COST PER 1K REACH"]);

    const fourHeaders: TableHeaderLabels = {
      resultColumns: [...threeHeaders.resultColumns, { label: "APP INSTALLS", costLabel: "COST PER INSTALL" }],
    };
    const fourRow = tableRow({
      resultColumns: [...threeRow.resultColumns, resultCol("APP INSTALLS", "COST PER INSTALL")],
    });
    const fourGrid = buildCombinedTotalTableGrid(fourRow, fourRow, fourHeaders);
    expect(fourGrid[0]).toHaveLength(14);
    expect(fourGrid[0][12]).toBe("APP INSTALLS");
  });

  it("aligns each row's data under the right header column by label, not position, when the two rows' objective mixes differ", () => {
    const headers: TableHeaderLabels = {
      resultColumns: [
        { label: "LEADS (FORM)", costLabel: "COST PER LEAD" },
        { label: "PURCHASES", costLabel: "COST PER PURCHASE" },
      ],
    };
    // Period row only ran Purchases; MTD row only runs Leads — a real
    // scenario where the objective mix changed between the two periods.
    const periodRow = tableRow({ resultColumns: [resultCol("PURCHASES", "COST PER PURCHASE", "5", "₹40.00")] });
    const mtdRow = tableRow({ resultColumns: [resultCol("LEADS (FORM)", "COST PER LEAD", "12", "₹15.00")] });
    const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, headers);

    // Period row: Leads column is blank, Purchases column has real data.
    expect(grid[1]).toEqual(["Jul 1 - Jul 23", "₹1,000", "5,000", "10,000", "1.50%", "₹2.00", "—", "—", "5", "₹40.00"]);
    // MTD row: the reverse.
    expect(grid[2]).toEqual(["Jul 1 - Jul 23", "₹1,000", "5,000", "10,000", "1.50%", "₹2.00", "12", "₹15.00", "—", "—"]);
  });

  // MTD month label.
  it("row 2 (MTD) column 0 carries the ' MTD'-suffixed month label computeTableRow already produced", () => {
    const periodRow = tableRow({ monthLabel: "Jun 1 - Jun 30" });
    const mtdRow = tableRow({ monthLabel: "Jul 1 - Jul 23 MTD" });
    const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, oneObjectiveHeaders);
    expect(grid[1][0]).toBe("Jun 1 - Jun 30");
    expect(grid[2][0]).toBe("Jul 1 - Jul 23 MTD");
  });

  it("row order matches TableRowData's own field order for every static column", () => {
    const periodRow = tableRow({ monthLabel: "M", spend: "S", reach: "R", impressions: "I", ctr: "C1", cpc: "C2" });
    const grid = buildCombinedTotalTableGrid(periodRow, tableRow(), oneObjectiveHeaders);
    expect(grid[1].slice(0, 6)).toEqual(["M", "S", "R", "I", "C1", "C2"]);
  });
});

describe("buildReportData — campaign selection and weekly-range wizard steps", () => {
  const shoes = buildDailyRows({
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
    frequency: 2,
  });
  const boots = buildDailyRows({
    campaign_name: "Boots - Leads",
    ad_set_name: "Prospecting",
    result_type: "Lead",
    spend: 60,
    reach: 500,
    impressions: 1500,
    results: 5,
    link_clicks: 20,
    ctr: 1.0,
    cpc: 2,
    frequency: 1.5,
  });
  const rows = [...shoes, ...boots];

  it("excludes an unselected campaign's rows entirely — not just from display", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: ["Shoes - Purchases"],
      now: NOW,
    });
    const names = data.campaignSlides.map((s) => s.campaignName);
    expect(names).toContain("Shoes - Purchases");
    expect(names).not.toContain("Boots - Leads");
    // Not just hidden from slides — Boots' spend must not leak into any total.
    expect(data.mtdRow.spend).toBe("₹700"); // 100/day * 7 days, Boots' 60/day*7=420 excluded
  });

  it("includes every campaign when selectedCampaigns is omitted", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const names = data.campaignSlides.map((s) => s.campaignName);
    expect(names).toEqual(["Boots - Leads", "Shoes - Purchases"]);
  });

  it("uses an explicit weeklyRange for the campaign/chart slides' date window", () => {
    // buildDailyRows only generates 13-19 July, so pick a sub-range within
    // that to prove the override is actually applied (a range with zero
    // matching rows would just look "paused" and wouldn't prove anything).
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      weeklyRange: { startIso: "2026-07-15", endIso: "2026-07-17" },
      now: NOW,
    });
    expect(data.cover.dateRange).toBe("July 15 - July 17");
    // MTD is unaffected by the weekly selection — still every day the fixture
    // has data for (13-19; the fixture doesn't include days 1-12).
    expect(data.mtdRow.monthLabel).toBe("July 13 - July 19");
  });
});

describe("buildReportData — active campaign count from delivery status", () => {
  function statusRow(campaignName: string, deliveryStatus: string, day: string): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: "Ad Set 1",
      result_type: "Purchase",
      delivery_status: deliveryStatus,
      spend: "100",
      reach: "1000",
      impressions: "3000",
      results: "2",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  it("counts only campaigns with an active-reading delivery status when the CSV has that column", () => {
    const rows = [
      ...daysInclusive(13, 19).map((day) => statusRow("Live Campaign", "Active", day)),
      ...daysInclusive(13, 19).map((day) => statusRow("Paused Campaign", "Campaign paused", day)),
      ...daysInclusive(13, 19).map((day) => statusRow("Idle Campaign", "Not delivering", day)),
    ];
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });

    expect(data.chart!.activeCampaignCount).toBe(1);
    const live = data.chart!.campaigns.find((c) => c.name === "Live Campaign")!;
    const paused = data.chart!.campaigns.find((c) => c.name === "Paused Campaign")!;
    const idle = data.chart!.campaigns.find((c) => c.name === "Idle Campaign")!;
    expect(live.isActive).toBe(true);
    expect(live.statusIndicator).toBeNull();
    expect(paused.isActive).toBe(false);
    expect(paused.statusIndicator).toBe("Paused");
    expect(idle.isActive).toBe(false);
    expect(idle.statusIndicator).toBe("Inactive");
  });

  it("falls back to the spend-based heuristic when the CSV has no delivery-status column at all", () => {
    // No delivery_status field on any row — must not count everything as
    // inactive just because the column doesn't exist in this CSV.
    const rows = buildDailyRows({
      campaign_name: "No Status Column",
      ad_set_name: "Ad Set 1",
      result_type: "Purchase",
      spend: 100,
      reach: 1000,
      impressions: 3000,
      results: 2,
      link_clicks: 10,
      ctr: 1.5,
      cpc: 3,
      frequency: 2,
    });
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    expect(data.chart!.activeCampaignCount).toBe(1);
    expect(data.chart!.campaigns[0].isActive).toBe(true);
    expect(data.chart!.campaigns[0].statusIndicator).toBeNull();
  });
});

describe("buildReportData — campaign with every metric column blank (paused/zero-spend/just launched)", () => {
  // Campaign name and date are populated (as validate.ts now requires) but
  // every metric column is an empty string, so weekly spend sums to 0 for
  // this campaign — it gets no slide at all (zero weekly spend, see the
  // "Fix 1" describe block below), even though it does have real rows
  // within the reporting period, which is why isPaused (a different,
  // account-wide concept — "no rows in range at all") stays false.
  const blankRows: NreRow[] = daysInclusive(13, 19).map((day) => ({
    _raw: { Day: day },
    campaign_name: "Blank Metrics Campaign",
    ad_set_name: "Only Ad Set",
    result_type: "",
    spend: "",
    reach: "",
    impressions: "",
    results: "",
    link_clicks: "",
    ctr: "",
    cpc: "",
    frequency: "",
    date_start: day,
    date_end: day,
  }));

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: null,
    mtdDailyRows: blankRows,
    now: NOW,
  });

  it("is not paused — the campaign has rows within the reporting period, just zero values", () => {
    expect(data.isPaused).toBe(false);
  });

  it("generates no campaign slide at all — zero weekly spend", () => {
    expect(data.campaignSlides).toHaveLength(0);
    expect(data.adSetSlides).toHaveLength(0);
  });
});

describe("buildReportData — campaign status is active if ANY ad set is active", () => {
  function statusAdSetRow(campaignName: string, adSetName: string, deliveryStatus: string, day: string): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: adSetName,
      result_type: "Purchase",
      delivery_status: deliveryStatus,
      spend: "100",
      reach: "1000",
      impressions: "3000",
      results: "2",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  it("shows no badge on a campaign with one active and one paused ad set — previously always showed Inactive/Paused", () => {
    const rows = [
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("Mixed Campaign", "Active Ad Set", "Active", day)),
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("Mixed Campaign", "Paused Ad Set", "Campaign paused", day)),
    ];
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });

    const campaignSlide = data.campaignSlides.find((s) => s.campaignName === "Mixed Campaign")!;
    expect(campaignSlide.statusIndicator).toBeNull();

    const chartCampaign = data.chart!.campaigns.find((c) => c.name === "Mixed Campaign")!;
    expect(chartCampaign.isActive).toBe(true);
    expect(chartCampaign.statusIndicator).toBeNull();

    // Individual ad-set slides still show their own status correctly.
    const activeAdSet = data.adSetSlides.find((s) => s.adSetName === "Active Ad Set")!;
    const pausedAdSet = data.adSetSlides.find((s) => s.adSetName === "Paused Ad Set")!;
    expect(activeAdSet.statusIndicator).toBeNull();
    expect(pausedAdSet.statusIndicator).toBe("Paused");
  });

  it("still shows a badge when every ad set in the campaign is non-active", () => {
    const rows = [
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("All Paused Campaign", "Ad Set A", "Campaign paused", day)),
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("All Paused Campaign", "Ad Set B", "Not delivering", day)),
    ];
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const campaignSlide = data.campaignSlides.find((s) => s.campaignName === "All Paused Campaign")!;
    expect(campaignSlide.statusIndicator).toBe("Paused");
  });

  it("treats archived ad sets as non-active for the campaign roll-up", () => {
    const rows = [
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("Archived-Only Campaign", "Ad Set A", "Archived", day)),
      ...daysInclusive(13, 19).map((day) => statusAdSetRow("Archived-Only Campaign", "Ad Set B", "Archived", day)),
    ];
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const campaignSlide = data.campaignSlides.find((s) => s.campaignName === "Archived-Only Campaign")!;
    expect(campaignSlide.statusIndicator).toBe("Inactive");
  });
});

describe("buildReportData — a campaign with zero weekly spend gets no slide, even with real MTD spend", () => {
  function rowForDate(campaignName: string, day: string, opts: Partial<NreRow> = {}): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: "Only Ad Set",
      result_type: "Purchase",
      spend: "50",
      reach: "500",
      impressions: "1000",
      results: "3",
      ctr: "1.2",
      cpc: "2",
      date_start: day,
      date_end: day,
      ...opts,
    };
  }

  // "Live Campaign" ran the whole month including this week — keeps the
  // account-wide isPaused check (zero weekly rows ACROSS EVERY campaign)
  // from tripping, and doubles as the control: unaffected.
  const liveRows = daysInclusive(1, 19).map((day) => rowForDate("Live Campaign", day, { delivery_status: "Active" }));
  // Stopped entirely before the trailing 13-19 July weekly window (zero
  // weekly spend), but still has real spend earlier in the month (MTD).
  const stoppedRows = daysInclusive(1, 5).map((day) => rowForDate("Stopped Campaign", day, { delivery_status: "Not delivering" }));

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: null,
    mtdDailyRows: [...liveRows, ...stoppedRows],
    now: NOW,
  });

  it("is not paused overall", () => {
    expect(data.isPaused).toBe(false);
  });

  it("generates no campaign slide, and no ad-set slides, for the zero-weekly-spend campaign", () => {
    expect(data.campaignSlides.some((s) => s.campaignName === "Stopped Campaign")).toBe(false);
    expect(data.adSetSlides.some((s) => s.campaignName === "Stopped Campaign")).toBe(false);
  });

  it("still counts the stopped campaign's MTD spend in the Combined Total table's MTD row", () => {
    // 7 days x $50 = $350 MTD for the stopped campaign, on top of whatever
    // the live campaign contributes — just confirms it isn't filtered out
    // of mtdRows entirely, only out of the per-campaign slide set.
    expect(data.mtdRow.hasData).toBe(true);
    const mtdSpendNum = Number(data.mtdRow.spend.replace(/[^\d.]/g, ""));
    expect(mtdSpendNum).toBeGreaterThanOrEqual(350);
  });

  it("leaves the still-running campaign unaffected", () => {
    const liveSlide = data.campaignSlides.find((s) => s.campaignName === "Live Campaign")!;
    expect(liveSlide.metrics.spend).not.toBe("₹0");
    expect(liveSlide.statusIndicator).toBeNull();
  });
});

describe("buildReportData — ad-set slide filtering (MTD spend threshold + archived exclusion)", () => {
  function adSetRow(adSetName: string, spend: number, opts: Partial<NreRow> = {}): NreRow[] {
    return daysInclusive(13, 19).map((day) => ({
      _raw: { Day: day },
      campaign_name: "Multi AdSet Campaign",
      ad_set_name: adSetName,
      result_type: "Purchase",
      spend: String(spend),
      reach: "100",
      impressions: "300",
      results: "1",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
      ...opts,
    }));
  }

  const bigSpenderRows = adSetRow("Big Spender", 50); // 7 days x $50 = $350 MTD
  const tinySpenderRows = adSetRow("Tiny Spender", 0.1); // 7 days x $0.10 = $0.70 MTD — under $1
  const archivedRows = adSetRow("Archived AdSet", 50, { delivery_status: "Archived" }); // well above $1, but archived

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: null,
    mtdDailyRows: [...bigSpenderRows, ...tinySpenderRows, ...archivedRows],
    now: NOW,
  });

  it("gives the normal-spend ad set its own slide", () => {
    expect(data.adSetSlides.some((s) => s.adSetName === "Big Spender")).toBe(true);
  });

  it("excludes the ad set whose total MTD spend is under $1, even though it has weekly rows", () => {
    expect(data.adSetSlides.some((s) => s.adSetName === "Tiny Spender")).toBe(false);
  });

  it("excludes the archived ad set regardless of its spend", () => {
    expect(data.adSetSlides.some((s) => s.adSetName === "Archived AdSet")).toBe(false);
  });

  it("still counts every ad set's spend — including excluded ones — in the campaign summary total", () => {
    const campaignSlide = data.campaignSlides.find((s) => s.campaignName === "Multi AdSet Campaign")!;
    // 350 (Big Spender) + 0.70 (Tiny Spender) + 350 (Archived) = 700.70 -> rounds to 701
    expect(campaignSlide.metrics.spend).toBe("₹701");
  });

  it("still shows the campaign summary slide, with no ad-set slides at all, when every ad set in it is below the threshold", () => {
    function tinyAdSetRows(campaignName: string, adSetName: string, spend: number): NreRow[] {
      return daysInclusive(13, 19).map((day) => ({
        _raw: { Day: day },
        campaign_name: campaignName,
        ad_set_name: adSetName,
        result_type: "Purchase",
        spend: String(spend),
        reach: "10",
        impressions: "30",
        results: "0",
        ctr: "0",
        cpc: "0",
        date_start: day,
        date_end: day,
      }));
    }

    const tinyOnlyRows = [
      ...tinyAdSetRows("All Tiny Campaign", "Tiny A", 0.05),
      ...tinyAdSetRows("All Tiny Campaign", "Tiny B", 0.05),
    ];
    const tinyData = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: tinyOnlyRows,
      now: NOW,
    });
    expect(tinyData.campaignSlides.some((s) => s.campaignName === "All Tiny Campaign")).toBe(true);
    expect(tinyData.adSetSlides.filter((s) => s.campaignName === "All Tiny Campaign")).toHaveLength(0);
  });
});

// Fix 2/3 regression: an ad set can legitimately spend $0 in the trailing-7-
// day weekly window while still clearing the MTD spend threshold from
// earlier in the month — it still gets its own slide (Phase A2 gates on MTD
// spend, not weekly spend). That slide's spend must still show the currency
// symbol (fmtCurrency always prepends it, even at "0" — see format.ts) and
// its DATE_RANGE must still be the real global week range, not a fallback
// "unavailable" string — both already true of the current implementation,
// asserted here so neither can silently regress.
describe("buildReportData — ad-set slide with $0 spend in the weekly window but real earlier-month MTD spend", () => {
  function dailyRow(campaignName: string, adSetName: string, day: string, spend: number): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: adSetName,
      result_type: "Purchase",
      spend: String(spend),
      reach: "100",
      impressions: "300",
      results: "1",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  const earlyMonthDays = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];
  const weekDays = daysInclusive(13, 19); // the trailing-7-day window for NOW = 2026-07-20

  const rows: NreRow[] = [
    ...earlyMonthDays.map((day) => dailyRow("Mixed Campaign", "Zero This Week", day, 100)), // $500 MTD, all before the week
    ...weekDays.map((day) => dailyRow("Mixed Campaign", "Zero This Week", day, 0)), // $0 this week
    ...weekDays.map((day) => dailyRow("Mixed Campaign", "Active AdSet", day, 50)), // keeps the campaign's weekly total > 0
  ];

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: null,
    mtdDailyRows: rows,
    now: NOW,
  });

  it("still generates a slide for the ad set with $0 weekly spend", () => {
    expect(data.adSetSlides.some((s) => s.adSetName === "Zero This Week")).toBe(true);
  });

  it("shows the currency symbol on its $0 spend, not a bare '0'", () => {
    const slide = data.adSetSlides.find((s) => s.adSetName === "Zero This Week")!;
    expect(slide.metrics.spend).toBe("₹0");
  });

  it("uses the real global week date range, not a fallback 'unavailable' string", () => {
    const slide = data.adSetSlides.find((s) => s.adSetName === "Zero This Week")!;
    expect(slide.dateRangeLine).not.toContain("unavailable");
    expect(slide.dateRangeLine.startsWith("July 13")).toBe(true);
    // Same range every other slide in this report gets — never a per-slide computation of its own.
    const activeSlide = data.adSetSlides.find((s) => s.adSetName === "Active AdSet")!;
    expect(slide.dateRangeLine).toBe(activeSlide.dateRangeLine);
  });
});

describe("buildReportData — Fix 8: Monthly Report option", () => {
  function dailyRow(campaignName: string, day: string, spend: number): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: String(spend),
      reach: "100",
      impressions: "300",
      results: "2",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  // Spans July 1-19 — well outside the trailing-7-day window (July 13-19)
  // that a Weekly report would use — so a Monthly report picking this up
  // proves it's really using the full MTD range, not silently still the
  // weekly split.
  const mtdDays = Array.from({ length: 19 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const rows: NreRow[] = mtdDays.flatMap((day) => dailyRow("Shoes", day, 50));

  function build(reportType?: "WEEKLY" | "MONTHLY") {
    return buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      reportType,
      now: NOW,
    });
  }

  it("defaults to WEEKLY when reportType is omitted", () => {
    expect(build().reportType).toBe("WEEKLY");
  });

  it("echoes reportType back on the returned data", () => {
    expect(build("MONTHLY").reportType).toBe("MONTHLY");
  });

  it("uses the full MTD spend for campaign slides, not just the trailing-7-day window", () => {
    const weekly = build("WEEKLY");
    const monthly = build("MONTHLY");
    // Weekly: July 13-19 only = 7 days x ₹50 = ₹350. Monthly: all 19 days x ₹50 = ₹950.
    expect(weekly.campaignSlides[0].metrics.spend).toBe("₹350");
    expect(monthly.campaignSlides[0].metrics.spend).toBe("₹950");
  });

  it("shows the full MTD date range on campaign slides, not the trailing-7-day range", () => {
    const monthly = build("MONTHLY");
    expect(monthly.campaignSlides[0].dateRangeLine.startsWith("July 1 - July 19")).toBe(true);
  });

  it("shows the full MTD date range on the cover, not the trailing-7-day range", () => {
    const monthly = build("MONTHLY");
    expect(monthly.cover.dateRange.startsWith("July 1 - July 19")).toBe(true);
  });

  it("says 'Monthly' in the health score badge instead of 'Weekly'", () => {
    const monthly = build("MONTHLY");
    expect(monthly.cover.healthBadge).not.toContain("Weekly");
  });

  it("still computes the Combined Total table's MTD row from the full MTD data either way — unaffected by reportType", () => {
    const weekly = build("WEEKLY");
    const monthly = build("MONTHLY");
    expect(weekly.mtdRow.spend).toBe(monthly.mtdRow.spend);
  });

  it("shows the MTD date range on the chart sub-line for Weekly reports, not the trailing-7-day window", () => {
    // mtdDays spans July 1-19; the trailing-7-day weekly window is July
    // 13-19 (see NOW above) — the chart is always MTD data, so its sub-line
    // must show the full July 1-19 MTD range either way, not the narrower
    // weekly window.
    const weekly = build("WEEKLY");
    expect(weekly.chart?.periodSubLabel).toBe("July 1 - July 19, 2026");
  });

  it("keeps the 'Full Month' chart sub-line for Monthly reports", () => {
    const monthly = build("MONTHLY");
    expect(monthly.chart?.periodSubLabel).toBe("Full Month — July 2026");
  });

  it("is paused only when there's no data in the relevant window — an explicit weekly gap week for Weekly, vs. the full MTD for Monthly", () => {
    // Data on both sides of a genuine gap week (July 6-12, e.g. the account
    // paused mid-month): the wizard explicitly selected that gap week as the
    // weekly range (a real "previous 7 days" scenario), so Weekly has
    // nothing to show — but Monthly, using the full MTD span regardless,
    // still has plenty.
    const gapRows: NreRow[] = [...["2026-07-01", "2026-07-03"], ...["2026-07-15", "2026-07-19"]].flatMap((day) =>
      dailyRow("Shoes", day, 50),
    );
    const weekly = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: gapRows,
      reportType: "WEEKLY",
      weeklyRange: { startIso: "2026-07-06", endIso: "2026-07-12" },
      now: NOW,
    });
    const monthly = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: gapRows,
      reportType: "MONTHLY",
      now: NOW,
    });
    expect(weekly.isPaused).toBe(true); // nothing in the selected July 6-12 gap week
    expect(monthly.isPaused).toBe(false); // but real data earlier and later in the month
  });
});

describe("buildReportData — automatic 7-slot metric assignment (Change 2, no wizard input)", () => {
  // Unlike buildDailyRows above, _raw carries the actual CSV header names
  // slot-assignment.ts's dictionary lookups key off — the fixed-field
  // builder never needed this since aggregateRows only reads the mapped
  // NreMetricKey fields.
  function dynamicRow(day: string, spend: number, reach: number, ctr: number, resultType: string, extraRaw: Record<string, string> = {}): NreRow {
    return {
      _raw: { Day: day, "Amount spent": String(spend), Reach: String(reach), "CTR (all)": String(ctr), ...extraRaw },
      campaign_name: "Shoes",
      ad_set_name: "Set 1",
      result_type: resultType,
      spend: String(spend),
      reach: String(reach),
      impressions: "1000",
      results: "2",
      ctr: String(ctr),
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  const rows: NreRow[] = daysInclusive(13, 19).map((day) => dynamicRow(day, 50, 500, 2, "Purchase"));

  it("always populates dynamicMetrics with exactly 7 entries, with no selectedMetrics input at all", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const dynamicMetrics = data.campaignSlides[0].dynamicMetrics;
    expect(dynamicMetrics).toHaveLength(7);
  });

  it("keeps slots 1-3 (Spend/Reach/Impressions) and slot 6 (CTR) fixed regardless of objective", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    // 7 days x 50 = 350 spend; 7 days x 500 = 3500 reach (sum, matching the
    // fixed-field pipeline's own spend/reach treatment).
    expect(slots[0]).toMatchObject({ key: "spend", label: "AD SPEND", value: "$350" });
    expect(slots[1]).toMatchObject({ key: "reach", label: "REACH", value: "3,500" });
    expect(slots[2]).toMatchObject({ key: "impressions", label: "IMPRESSIONS" });
    expect(slots[5]).toMatchObject({ key: "ctr", label: "CTR (ALL)", value: data.campaignSlides[0].metrics.ctr });
  });

  it("assigns slots 4/5/7 for the PURCHASES objective (Results/Cost per Purchase/ROAS)", () => {
    const purchaseRows = daysInclusive(13, 19).map((day) => dynamicRow(day, 50, 500, 2, "Purchase", { "Results roas": "3.5" }));
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: purchaseRows,
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3]).toMatchObject({ key: "results", label: "PURCHASES" });
    expect(slots[4]).toMatchObject({ key: "cost_per_result", label: "COST PER PURCHASE" });
    expect(slots[6]).toMatchObject({ key: "results_roas", label: "ROAS" });
    expect(slots[6].value).not.toBe("—");
  });

  it("assigns slots 4/5/7 for the WEBSITE LEADS objective (Results/Cost per Lead/Link Clicks), reading the extra field straight off the raw CSV via the dictionary", () => {
    const leadsRows = daysInclusive(13, 19).map((day) => dynamicRow(day, 50, 500, 2, "Website leads", { "Link clicks": "10" }));
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: leadsRows,
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3]).toMatchObject({ key: "results", label: "WEBSITE LEADS" });
    expect(slots[4]).toMatchObject({ key: "cost_per_result", label: "COST PER WEBSITE LEAD" });
    expect(slots[6]).toMatchObject({ key: "link_clicks", label: "LINK CLICKS", value: "70" }); // 7 days x 10
  });

  it("assigns slots 4/5/7 for the REACH objective (CPM/Frequency/Link Clicks) — Frequency, not Cost Per 1K Reached", () => {
    const reachRows = daysInclusive(13, 19).map((day) =>
      dynamicRow(day, 50, 500, 2, "Reach", {
        "CPM (Cost per 1,000 Impressions)": "3",
        Frequency: "1.8",
        "Link clicks": "10",
      }),
    );
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: reachRows,
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3]).toMatchObject({ key: "cpm", label: "CPM" });
    expect(slots[4]).toMatchObject({ key: "frequency", label: "FREQUENCY", value: "1.80x" });
    expect(slots[6]).toMatchObject({ key: "link_clicks", label: "LINK CLICKS" });
  });

  it("shows a dash (not $0.00) for an extra dictionary field that's zero or absent from the CSV", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows, // no "Link clicks"/"Results roas" raw columns at all
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[6].value).toBe("—");
  });

  it("never splits a campaign into a second/continued slide — a campaign always gets exactly one slide with the automatic 7-slot assignment (Step 7)", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const slidesForShoes = data.campaignSlides.filter((s) => s.campaignName.startsWith("Shoes"));
    expect(slidesForShoes.length).toBe(1);
    expect(slidesForShoes[0].campaignName).toBe("Shoes");
    expect(slidesForShoes[0].dynamicMetrics.length).toBe(7);
  });
});

describe("buildComparisonReportData", () => {
  function comparisonDaysInclusive(startIso: string, endIso: string): string[] {
    const days: string[] = [];
    const start = new Date(startIso + "T00:00:00Z");
    const end = new Date(endIso + "T00:00:00Z");
    for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
      const d = new Date(ts);
      days.push(`${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`);
    }
    return days;
  }

  function comparisonRows(
    startIso: string,
    endIso: string,
    config: { campaign_name: string; result_type: string; spend: number; reach: number; results: number },
  ): NreRow[] {
    return comparisonDaysInclusive(startIso, endIso).map((day) => ({
      _raw: { Day: day },
      campaign_name: config.campaign_name,
      ad_set_name: "Ad Set 1",
      result_type: config.result_type,
      spend: String(config.spend),
      reach: String(config.reach),
      impressions: String(config.reach * 2),
      results: String(config.results),
      link_clicks: "0",
      ctr: "1",
      cpc: "1",
      frequency: "1",
      date_start: day,
      date_end: day,
    }));
  }

  const PERIOD_A = { startIso: "2026-08-01", endIso: "2026-08-06" };
  const PERIOD_B = { startIso: "2026-07-01", endIso: "2026-07-06" };

  // Runs in both periods, spend/reach/results doubling from B to A.
  const shoesA = comparisonRows("2026-08-01", "2026-08-06", {
    campaign_name: "Shoes - Purchases",
    result_type: "Purchase",
    spend: 100,
    reach: 1000,
    results: 2,
  });
  const shoesB = comparisonRows("2026-07-01", "2026-07-06", {
    campaign_name: "Shoes - Purchases",
    result_type: "Purchase",
    spend: 50,
    reach: 800,
    results: 1,
  });
  // Only ran in Period A — Period B should read "New" for every metric.
  const brandNewA = comparisonRows("2026-08-01", "2026-08-06", {
    campaign_name: "Brand - New",
    result_type: "Purchase",
    spend: 40,
    reach: 500,
    results: 1,
  });

  function baseInput() {
    return {
      accountName: "Acme Inc",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: [...shoesA, ...shoesB, ...brandNewA],
      periodA: PERIOD_A,
      periodB: PERIOD_B,
      now: new Date("2026-08-07T12:00:00Z"),
    };
  }

  it("splits rows into Period A/B and aggregates each campaign independently", () => {
    const result = buildComparisonReportData(baseInput());
    const shoes = result.campaigns.find((c) => c.campaignName === "Shoes - Purchases")!;

    // 6 days x 100/day = 600 in Period A, 6 days x 50/day = 300 in Period B.
    expect(shoes.metricsA.spend.value).toBe(600);
    expect(shoes.metricsB.spend.value).toBe(300);
    expect(shoes.metricsA.reach.value).toBe(6000);
    expect(shoes.metricsB.reach.value).toBe(4800);
    expect(shoes.metricsA.results.value).toBe(12);
    expect(shoes.metricsB.results.value).toBe(6);
  });

  it("computes change = ((A - B) / B) * 100, with up/down/flat directions", () => {
    const result = buildComparisonReportData(baseInput());
    const shoes = result.campaigns.find((c) => c.campaignName === "Shoes - Purchases")!;

    // Spend doubled: (600-300)/300*100 = 100%.
    expect(shoes.changes.spend.percent).toBeCloseTo(100);
    expect(shoes.changes.spend.direction).toBe("up");

    // Reach: (6000-4800)/4800*100 = 25%.
    expect(shoes.changes.reach.percent).toBeCloseTo(25);
    expect(shoes.changes.reach.direction).toBe("up");

    // Cost per result stayed flat at $50 in both periods -> 0%, "flat".
    expect(shoes.metricsA.cpr.value).toBeCloseTo(50);
    expect(shoes.metricsB.cpr.value).toBeCloseTo(50);
    expect(shoes.changes.cpr.percent).toBeCloseTo(0);
    expect(shoes.changes.cpr.direction).toBe("flat");
  });

  it("reports 'New' (null percent, 'new' direction) when Period B's value is 0", () => {
    const result = buildComparisonReportData(baseInput());
    const brandNew = result.campaigns.find((c) => c.campaignName === "Brand - New")!;

    expect(brandNew.metricsA.spend.value).toBe(240); // 6 days x 40/day
    expect(brandNew.metricsB.spend.value).toBe(0);
    expect(brandNew.changes.spend.percent).toBeNull();
    expect(brandNew.changes.spend.direction).toBe("new");
    expect(brandNew.changes.results.direction).toBe("new");
  });

  it("treats both-periods-zero as flat (0%), not 'New'", () => {
    const result = buildComparisonReportData({ ...baseInput(), mtdDailyRows: [] });
    expect(result.totals.changes.spend).toEqual({ percent: 0, direction: "flat" });
    expect(result.isPaused).toBe(true);
  });

  it("sums totals across every campaign for both periods", () => {
    const result = buildComparisonReportData(baseInput());
    // Shoes (600+240) + Brand New (240 in A only) = 840 in A; 300 in B.
    expect(result.totals.metricsA.spend.value).toBe(840);
    expect(result.totals.metricsB.spend.value).toBe(300);
    expect(result.totals.metricsA.results.value).toBe(18); // 12 + 6
    expect(result.totals.metricsB.results.value).toBe(6);
    expect(result.isPaused).toBe(false);
  });

  it("formats periodALabel/periodBLabel via getComparisonPeriodLabel", () => {
    const result = buildComparisonReportData(baseInput());
    expect(result.periodALabel).toBe("Aug 1 - Aug 6, 2026");
    expect(result.periodBLabel).toBe("Jul 1 - Jul 6, 2026");
  });

  it("respects selectedCampaigns filtering", () => {
    const result = buildComparisonReportData({ ...baseInput(), selectedCampaigns: ["Shoes - Purchases"] });
    expect(result.campaigns.map((c) => c.campaignName)).toEqual(["Shoes - Purchases"]);
  });

  it("detects the campaign's real objective (not a generic 'RESULTS' fallback)", () => {
    const result = buildComparisonReportData(baseInput());
    const shoes = result.campaigns.find((c) => c.campaignName === "Shoes - Purchases")!;
    expect(shoes.objective).toBe("PURCHASES");
    expect(shoes.costLabel).toBe("COST PER PURCHASE");
  });
});
