import { describe, expect, it, beforeAll } from "vitest";
import {
  buildCombinedTotalTableGrid,
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
      // " MTD" suffix marks this as a partial, still-in-progress month,
      // distinct from the Period row's completed-month date range.
      monthLabel: "July 13 - July 19 MTD",
      spend: "₹2,450",
      // A straight sum of the daily rows' reach — see the dedicated reach test below.
      reach: "82,600",
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

  // Regression: the Period CSV (previous full month, optional second
  // upload) fed straight into the table slide's "Period" row without ever
  // going through filterRowsByCampaigns/filterRowsByAdSets — a deselected
  // ad set's spend still reached the report via that row even though the
  // MTD row correctly excluded it.
  it("also applies ad-set/campaign selection to the Period CSV, not just the MTD Daily CSV", () => {
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
    expect(data.periodRow.result1).toBe("10");
  });

  it("deselecting an entire campaign also removes its Period CSV rows", () => {
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
    // Only the MTD row gets the " MTD" suffix — the Period row is a
    // completed month, not a partial in-progress one.
    expect(data.periodRow.monthLabel).not.toContain("MTD");
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
    // it's group 1 (columns 7-8) and subscriptions is group 2 (columns 9-10).
    expect(data.tableHeaderLabels).toEqual({
      result1Label: "META FORM LEADS",
      cpr1Label: "COST PER LEAD",
      result2Label: "SUBSCRIPTIONS",
      cpr2Label: "COST PER SUBSCRIPTION",
    });
  });

  it("sums daily reach in the MTD row for this scenario too", () => {
    // leadsForm 4000/day + websiteSubs 3000/day, x7 days = 49,000.
    expect(data.mtdRow.reach).toBe("49,000");
  });
});

describe("buildCombinedTotalTableGrid", () => {
  function tableRow(overrides: Partial<TableRowData> = {}): TableRowData {
    return {
      hasData: true,
      monthLabel: "Jul 1 - Jul 23",
      spend: "₹1,000",
      reach: "5,000",
      impressions: "10,000",
      ctr: "1.50%",
      cpc: "₹2.00",
      result1: "20",
      cpr1: "₹50.00",
      result2: "—",
      cpr2: "—",
      g1Label: "RESULTS",
      g1CprLabel: "COST PER RESULT",
      g2Label: null,
      g2CprLabel: null,
      ...overrides,
    };
  }

  const headers: TableHeaderLabels = {
    result1Label: "QUOTE REQUESTS",
    cpr1Label: "COST PER QUOTE REQUEST",
    result2Label: "—",
    cpr2Label: "—",
  };

  // Rule 1: the grid is always exactly 3 rows x 10 columns.
  it("is always exactly 3 rows by 10 columns", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), headers);
    expect(grid).toHaveLength(3);
    for (const row of grid) expect(row).toHaveLength(10);
  });

  it("row 0 is the header row: 6 static labels then the 4 dynamic objective labels", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), headers);
    expect(grid[0]).toEqual([
      ...COMBINED_TOTAL_STATIC_HEADERS,
      "QUOTE REQUESTS",
      "COST PER QUOTE REQUEST",
      "—",
      "—",
    ]);
  });

  // Rule 2: reach column (index 2) — the grid builder just carries whatever
  // computeTableRow gave it straight through; both rows now get a real
  // summed number (see computeTableRow's own reach tests for the sum logic).
  it("column 2 (Reach): carries the Period and MTD row's own reach values through unchanged", () => {
    const periodRow = tableRow({ reach: "46,266" });
    const mtdRow = tableRow({ reach: "90,779" });
    const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, headers);
    expect(grid[0][2]).toBe("Reach"); // header never disappears
    expect(grid[1][2]).toBe("46,266"); // Period row
    expect(grid[2][2]).toBe("90,779"); // MTD row
  });

  // Rule 3: dynamic result columns (indexes 6-9) show real objective names.
  it("columns 6-9: show the actual objective names, never generic 'Results'/'CPR'", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), headers);
    expect(grid[0][6]).toBe("QUOTE REQUESTS");
    expect(grid[0][7]).toBe("COST PER QUOTE REQUEST");
    expect(grid[0][6]).not.toBe("Results");
    expect(grid[0][7]).not.toBe("CPR");
  });

  it("columns 8-9 show '—' when there's no second objective", () => {
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), headers);
    expect(grid[0][8]).toBe("—");
    expect(grid[0][9]).toBe("—");
  });

  it("columns 8-9 show the real second objective's labels when one exists", () => {
    const twoObjectiveHeaders: TableHeaderLabels = {
      result1Label: "LEADS (FORM)",
      cpr1Label: "COST PER LEAD",
      result2Label: "WEBSITE SUBSCRIPTIONS",
      cpr2Label: "COST PER SUBSCRIPTION",
    };
    const grid = buildCombinedTotalTableGrid(tableRow(), tableRow(), twoObjectiveHeaders);
    expect(grid[0][8]).toBe("WEBSITE SUBSCRIPTIONS");
    expect(grid[0][9]).toBe("COST PER SUBSCRIPTION");
  });

  // Rule 5: MTD month label.
  it("row 2 (MTD) column 0 carries the ' MTD'-suffixed month label computeTableRow already produced", () => {
    const periodRow = tableRow({ monthLabel: "Jun 1 - Jun 30" });
    const mtdRow = tableRow({ monthLabel: "Jul 1 - Jul 23 MTD" });
    const grid = buildCombinedTotalTableGrid(periodRow, mtdRow, headers);
    expect(grid[1][0]).toBe("Jun 1 - Jun 30");
    expect(grid[2][0]).toBe("Jul 1 - Jul 23 MTD");
  });

  it("row order matches TableRowData's own field order for every column", () => {
    const periodRow = tableRow({
      monthLabel: "M", spend: "S", reach: "R", impressions: "I", ctr: "C1", cpc: "C2",
      result1: "R1", cpr1: "CP1", result2: "R2", cpr2: "CP2",
    });
    const grid = buildCombinedTotalTableGrid(periodRow, tableRow(), headers);
    expect(grid[1]).toEqual(["M", "S", "R", "I", "C1", "C2", "R1", "CP1", "R2", "CP2"]);
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
    expect(data.mtdRow.monthLabel).toBe("July 13 - July 19 MTD");
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
