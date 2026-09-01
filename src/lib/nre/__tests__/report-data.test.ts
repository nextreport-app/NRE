import { describe, expect, it, beforeAll } from "vitest";
import {
  buildCombinedTotalTableGrid,
  buildComparisonReportData,
  buildPreviousMonthSummaryReportData,
  buildReportData,
  compactSameMonthRangeLabel,
  COMBINED_TOTAL_STATIC_HEADERS,
  type TableHeaderLabels,
  type TableRowData,
} from "../report-data";
import { adSetKey } from "../ad-sets";
import type { NreRow } from "../columns";
import { defaultMetaSelection, type SelectedMetric } from "../available-metrics";

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

  // Fix 3 (AI campaign summary for Reach campaigns) — ai.cpm feeds the
  // Reach/Awareness-specific summary prompt and fallback templates in
  // prompts.ts, which never use costLabel's own "COST PER 1K REACH" value
  // (that divides by reach, not impressions).
  it("computes ai.cpm (spend / impressions × 1000) for both campaign and ad-set slides", () => {
    const brand = data.campaignSlides.find((s) => s.campaignName === "Brand - Reach")!;
    expect(brand.resultLabel).toBe("REACH");
    // spend 200/day × 7 = ₹1,400; impressions 15,000/day × 7 = 105,000 → (1400/105000)*1000 = ₹13.33
    expect(brand.ai.cpm).toBe("₹13.33");

    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    // spend (100+50)/day × 7 = ₹1,050; impressions (3000+2000)/day × 7 = 35,000 → ₹30.00
    expect(shoes.ai.cpm).toBe("₹30.00");

    const prospectingSlide = data.adSetSlides.find((s) => s.adSetName === "Prospecting")!;
    // spend 100/day × 7 = ₹700; impressions 3,000/day × 7 = 21,000 → ₹33.33
    expect(prospectingSlide.ai.cpm).toBe("₹33.33");
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
    // (Shoes campaign, real results) and Reach (Brand campaign) — both earn
    // their own column pair. Reach's own "count" is always 0 (Meta doesn't
    // populate a results figure for a real Reach objective), but it still
    // has real spend, so it's shown with an N/A-free, genuinely computed
    // Cost Per 1K Reach — a per-objective-spend fix (this round): each
    // objective's cost divides ONLY that objective's own campaigns' spend,
    // never the combined account-wide total, so Reach's ₹1,400 spend / 70,000
    // reach = ₹20.00 per 1K, and Purchases' own ₹1,050 spend / 21 results =
    // ₹50.00 (matching shoesChart.cpr above exactly) — not the old, wrongly
    // inflated ₹2,450 (combined) / 21 = ₹116.67.
    expect(data.mtdRow).toMatchObject({
      hasData: true,
      // Fix 3 (round 4) — just the plain date range: no "MTD" suffix, no
      // year (the chart slide's own sub-line still gets the year, computed
      // separately from fullMonthLabel — see buildReportData's
      // periodSubLabel). Fix 2 (round 5) — same-month ranges compact to
      // "July 13 - 19" instead of repeating "July".
      monthLabel: "July 13 - 19",
      spend: "₹2,450",
      // A straight sum of the daily rows' reach — see the dedicated reach test below.
      reach: "82,600",
      impressions: "140,000",
      // Recalculated from combined totals (bug fix), not averaged across
      // the 3 campaigns' own per-row CTR/CPC: implied clicks per day are
      // 45 (Prospecting, 1.5% of 3000) + 50 (Retargeting, 2.5% of 2000) +
      // 120 (Awareness, 0.8% of 15000) = 215/day, x7 days = 1505 total —
      // combinedCtr = 1505/140,000 x100 = 1.075% -> "1.07%" (float
      // rounding); combinedCpc = (350x7 total spend) / 1505 clicks = ₹1.63.
      ctr: "1.07%",
      cpc: "₹1.63",
      // Per-objective spend tracking (this round): Cost Per Purchase divides
      // ONLY the Purchases campaign's own ₹1,050 spend (₹1,050 / 21 = ₹50.00,
      // matching getGroupedResultDisplay's per-campaign-slide calculation
      // exactly — see the "campaign summary metrics" tests above), never
      // the combined ₹2,450 account-wide total. Cost Per 1K Reach likewise
      // divides only the Reach campaign's own ₹1,400 spend by its own
      // 70,000 reach. Ordered by each objective's own spend descending —
      // Reach's ₹1,400 outspends Purchases' ₹1,050.
      resultColumns: [
        { label: "REACH", costLabel: "COST PER 1K REACH", value: "0", cprValue: "₹20.00" },
        { label: "PURCHASES", costLabel: "COST PER PURCHASE", value: "21", cprValue: "₹50.00" },
      ],
    });
    expect(data.tableHeaderLabels).toEqual({
      resultColumns: [
        { label: "REACH", costLabel: "COST PER 1K REACH" },
        { label: "PURCHASES", costLabel: "COST PER PURCHASE" },
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
  //
  // selectedAdSets ONLY prunes which ad-set slides get built (Phase A2) — it
  // never filters mtdDailyRows itself, unlike selectedCampaigns. An earlier
  // version of this filter ran before splitMtdDaily and was removed from the
  // wizard because it silently shrank MTD totals below the real account
  // spend, misleading clients (see BuildReportDataInput.selectedAdSets's doc
  // comment) — these tests guard against that regression.
  it("excluding an ad set removes only its own slide — campaign totals, the chart, and the MTD/table rows are unaffected", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      selectedAdSets: [adSetKey("Shoes - Purchases", "Prospecting"), adSetKey("Brand - Reach", "Awareness")],
      now: NOW,
    });

    // Retargeting's own slide is gone...
    expect(data.adSetSlides.some((s) => s.adSetName === "Retargeting")).toBe(false);
    // ...but Shoes' campaign summary still reflects BOTH ad sets' combined
    // spend (700 + 350 = 1,050) — the excluded ad set's rows were never
    // removed from the underlying data, only its own slide was skipped.
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    expect(shoes.metrics.spend).toBe("₹1,050");
    expect(data.chart!.campaigns.find((c) => c.name === "Shoes - Purchases")!.spend).toBe(1050);
  });

  it("deselecting every ad set in a multi-ad-set campaign shows a campaign slide with no ad-set slides underneath it — the campaign itself and the report totals are untouched", () => {
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

    // Both campaigns still get their summary slide — deselecting ad sets
    // never removes a campaign.
    expect(data.campaignSlides.map((s) => s.campaignName)).toEqual(["Brand - Reach", "Shoes - Purchases"]);
    // Neither Shoes ad set gets its own slide (both deselected)...
    expect(data.adSetSlides.some((s) => s.campaignName === "Shoes - Purchases")).toBe(false);
    // ...but Brand's single ad set, being explicitly selected, does get its
    // own opt-in slide (see report-data.ts's Phase A2 doc comment — a
    // single-ad-set campaign's slide is opt-in via selection, not an
    // automatic skip, once real selection info is present).
    expect(data.adSetSlides.map((s) => s.adSetName)).toEqual(["Awareness"]);
    // ...but Shoes' own totals are unaffected (still both ad sets' spend).
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Purchases")!;
    expect(shoes.metrics.spend).toBe("₹1,050");
    expect(data.chart!.campaigns.map((c) => c.name).sort()).toEqual(["Brand - Reach", "Shoes - Purchases"]);
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

  // Regression (bug fix): Previous Month Data (previous full month, optional
  // second upload) has its own INDEPENDENT campaign selection
  // (Client.previousMonthSelectedCampaigns), already applied upstream by
  // loadPreviousMonthDataRows() before periodRows ever reaches
  // buildReportData. The MTD Daily CSV's own selectedCampaigns/selectedAdSets
  // must have NO effect on it — re-applying them here used to silently drop
  // a previous-month campaign/ad set that wasn't present in (or selectable
  // from) the current month's MTD CSV, e.g. a campaign paused this month
  // that still had spend last month.
  it("does not re-filter Previous Month Data by the MTD CSV's own selectedAdSets", () => {
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
      // Only Prospecting selected for the MTD CSV — must have zero effect on
      // Previous Month Data: both ad sets' spend ($500 + $300) are summed.
      selectedAdSets: [adSetKey("Shoes - Purchases", "Prospecting"), adSetKey("Brand - Reach", "Awareness")],
      now: NOW,
    });

    expect(data.periodRow.spend).toBe("$800");
    expect(data.periodRow.resultColumns.find((c) => c.label === "PURCHASES")?.value).toBe("15");
  });

  it("does not re-filter Previous Month Data by the MTD CSV's own selectedCampaigns", () => {
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
      // MTD CSV's own selection excludes "Brand - Reach" from the MTD row —
      // Previous Month Data still shows it, since it wasn't excluded from
      // Client.previousMonthSelectedCampaigns.
      selectedCampaigns: ["Shoes - Purchases"],
      now: NOW,
    });

    expect(data.periodRow.hasData).toBe(true);
    expect(data.periodRow.spend).toBe("$900");
  });

  it("combined total's Previous Month row sums ALL campaigns in previousMonthSelectedCampaigns, including one paused during the current month", () => {
    // Simulates what loadPreviousMonthDataRows() hands buildReportData when
    // previousMonthSelectedCampaigns lists 2 campaigns and both have spend
    // in the Previous Month Data CSV — "Campaign B" is paused this month
    // (absent from mtdDailyRows/selectedCampaigns entirely) but still had
    // real spend last month, and must still be counted.
    const periodRows = [
      {
        _raw: {},
        campaign_name: "Campaign A",
        ad_set_name: "Set 1",
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
        campaign_name: "Campaign B",
        ad_set_name: "Set 1",
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
      // Current month's MTD CSV only ever had "Shoes - Purchases"/"Brand -
      // Reach" — neither "Campaign A" nor "Campaign B" is selectable here,
      // proving the Previous Month row doesn't depend on this selection.
      selectedCampaigns: ["Shoes - Purchases", "Brand - Reach"],
      now: NOW,
    });

    expect(data.periodRow.hasData).toBe(true);
    expect(data.periodRow.spend).toBe("$800");
    expect(data.periodRow.reach).toBe("3,000");
    expect(data.periodRow.impressions).toBe("6,000");
    expect(data.periodRow.resultColumns.find((c) => c.label === "PURCHASES")?.value).toBe("15");
  });
});

// Regression (bug fix, round 2): after fixing the double-filter bug that
// dropped a selected campaign entirely, spend/reach/impressions/results
// summed correctly — but CTR (All)/CPC (All) were still a plain arithmetic
// mean of each row's own CTR/CPC value (equal weight regardless of volume),
// and per-objective cost-per-result must likewise come from combined
// spend/count, never from averaging each campaign's own ratio.
describe("computeTableRow (via periodRow/mtdRow) — ratio/average metrics recalculated from combined totals, not summed or averaged", () => {
  // Campaign A: 10,000 impressions, 5% CTR -> 500 implied clicks, $1000 spend, $2 CPC.
  // Campaign B: 1,000 impressions, 2% CTR -> 20 implied clicks, $100 spend, $5 CPC.
  // A plain average of the two rows' own CTR/CPC ((5+2)/2=3.5%, (2+5)/2=$3.50)
  // would be wrong either way — it happens to equal neither campaign's real
  // combined rate, which is exactly why it must be recalculated instead.
  const twoCampaignPeriodRows: NreRow[] = [
    {
      _raw: {},
      campaign_name: "Campaign A",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: "1000",
      reach: "4000",
      impressions: "10000",
      results: "0",
      ctr: "5",
      cpc: "2",
      date_start: "01-06-2026",
      date_end: "30-06-2026",
    },
    {
      _raw: {},
      campaign_name: "Campaign B",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: "100",
      reach: "400",
      impressions: "1000",
      results: "0",
      ctr: "2",
      cpc: "5",
      date_start: "01-06-2026",
      date_end: "30-06-2026",
    },
  ];

  it("CTR (All) = combined implied clicks / combined impressions x 100 — not the average of the 2 campaigns' own CTRs (3.50%)", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: twoCampaignPeriodRows,
      now: NOW,
    });

    // (500 + 20) / (10,000 + 1,000) x 100 = 4.727...% -> "4.73%"
    expect(data.periodRow.ctr).toBe("4.73%");
  });

  it("CPC (All) = combined spend / combined implied clicks — not the average of the 2 campaigns' own CPCs ($3.50)", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: twoCampaignPeriodRows,
      now: NOW,
    });

    // (1000 + 100) / (500 + 20) = 2.1153... -> "$2.12"
    expect(data.periodRow.cpc).toBe("$2.12");
  });

  it("Cost Per Lead = combined spend / combined leads — not the average of the 2 campaigns' own CPLs ($60)", () => {
    // Campaign X: $1000 spend, 10 leads -> its own CPL is $100.
    // Campaign Y: $300 spend, 15 leads -> its own CPL is $20.
    // Averaging those two CPLs gives $60 — wrong either way, since the real
    // combined rate is total spend / total leads = $52.
    const periodRows: NreRow[] = [
      {
        _raw: {},
        campaign_name: "Campaign X",
        ad_set_name: "Set 1",
        result_type: "Lead",
        spend: "1000",
        reach: "3000",
        impressions: "8000",
        results: "10",
        ctr: "3",
        cpc: "4",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      {
        _raw: {},
        campaign_name: "Campaign Y",
        ad_set_name: "Set 1",
        result_type: "Lead",
        spend: "300",
        reach: "1500",
        impressions: "4000",
        results: "15",
        ctr: "1.5",
        cpc: "1",
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
      now: NOW,
    });

    // result_type "Lead" is now resolved via result-type-map.ts's exact
    // machine-string match (Objective Confirmation permanent fix) as the
    // more specific WEBSITE LEADS, not the old fuzzy-catalog generic LEADS
    // fallback — the math being tested here (combined-totals CPL, not an
    // average of the two campaigns' own CPLs) is unaffected either way.
    const leadsColumn = data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(leadsColumn?.costLabel).toBe("COST PER WEBSITE LEAD");
    expect(leadsColumn?.value).toBe("25");
    // (1000 + 300) / (10 + 15) = 52.00, not the $60 simple average.
    expect(leadsColumn?.cprValue).toBe("$52.00");
  });

  it("applies the exact same combined-totals recalculation to the MTD row, not just the Previous Month row", () => {
    const mtdRowsTwoCampaigns: NreRow[] = twoCampaignPeriodRows.map((row) => ({
      ...row,
      date_start: "13-07-2026",
      date_end: "13-07-2026",
    }));

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: mtdRowsTwoCampaigns,
      now: NOW,
    });

    expect(data.mtdRow.ctr).toBe("4.73%");
    expect(data.mtdRow.cpc).toBe("$2.12");
  });

  // Per-objective spend tracking (this round) — reverses the earlier
  // "round 3" behavior: Cost Per Website Lead must divide ONLY the Website
  // Leads campaign's own $200 spend, never a same-account Traffic
  // campaign's unrelated $156 spend just because the "Ad Spend" column
  // happens to show their $356 combined total. The Traffic campaign's own
  // Link Clicks objective still earns its own column pair, with 0 results
  // and an N/A cost (real spend, no results — not a calculated number).
  it("Cost Per Website Lead uses ONLY the Website Leads campaign's own spend, never a same-account Traffic campaign's unrelated spend", () => {
    const periodRows: NreRow[] = [
      {
        _raw: {},
        campaign_name: "Leads Campaign",
        ad_set_name: "Set 1",
        result_type: "Website lead",
        spend: "200",
        reach: "3000",
        impressions: "9000",
        results: "5",
        ctr: "1.5",
        cpc: "6",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      {
        _raw: {},
        // Different objective, zero leads — its spend must still count
        // toward the displayed Ad Spend total, and toward Cost Per Website
        // Lead's denominator, since that's the same number shown in the
        // "Ad Spend" column of this exact table row.
        campaign_name: "Traffic Campaign",
        ad_set_name: "Set 1",
        result_type: "Link Click",
        spend: "156",
        reach: "2000",
        impressions: "6000",
        results: "0",
        ctr: "1",
        cpc: "3",
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
      now: NOW,
    });

    // Ad Spend always shows the full combined total — unaffected by the
    // per-objective cost-calculation fix.
    expect(data.periodRow.spend).toBe("$356");
    const leadsColumn = data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(leadsColumn?.costLabel).toBe("COST PER WEBSITE LEAD");
    expect(leadsColumn?.value).toBe("5");
    // $200 (Website Leads campaign's own spend) / 5 = $40.00 — NOT
    // $356 / 5 = $71.20 (the combined-total bug this round fixes).
    expect(leadsColumn?.cprValue).toBe("$40.00");

    const linkClicksColumn = data.periodRow.resultColumns.find((c) => c.label === "LINK CLICKS");
    expect(linkClicksColumn?.value).toBe("0");
    expect(linkClicksColumn?.cprValue).toBe("N/A");
  });
});

// Regression (bug fix, round 4, refined this round): the generic "RESULTS"
// fallback bucket (a stray blank-result_type row that getResultLabels can't
// classify as any real objective) must never surface as its own column,
// with or without spend — it isn't a real, nameable objective a client
// would recognize. A genuine objective's own 0-count column (e.g. Reach,
// whose "count" is always 0 since Meta doesn't populate a results figure
// for it; or Website Leads with real spend but no leads yet) is NOT
// hidden — it's shown with its real count (0) and an N/A cost, per this
// round's explicit "still show this objective column so the client can
// see the spend existed" requirement.
describe("computeTableRow (via periodRow/mtdRow) — the generic RESULTS fallback bucket never gets its own column", () => {
  function leadRow(overrides: Partial<NreRow> = {}): NreRow {
    return {
      _raw: {},
      campaign_name: "Leads Campaign",
      ad_set_name: "Set 1",
      result_type: "Website lead",
      spend: "100",
      reach: "3000",
      impressions: "9000",
      results: "5",
      ctr: "1.5",
      cpc: "6",
      date_start: "01-06-2026",
      date_end: "30-06-2026",
      ...overrides,
    };
  }

  it("an account with only Website Leads campaigns shows Website Leads + Cost Per Website Lead only — no Results/Cost Per Result column", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [leadRow()],
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toEqual([
      { label: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", value: "5", cprValue: "$20.00" },
    ]);
    expect(data.periodRow.resultColumns.some((c) => c.label === "RESULTS")).toBe(false);
  });

  it("a blank result_type row that buckets into the generic 0-count RESULTS group is dropped, leaving only the real objective", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        leadRow(),
        // No result_type, no reach, no objective-specific column data at all
        // -> resolveObjective's absolute-last-resort generic "RESULTS"
        // bucket, with 0 results — must not surface as its own dead column.
        // (reach must be explicitly zeroed too: getResultGroups now runs the
        // full Priority 1-4 chain, including the Priority 4 reach fallback,
        // so a non-zero reach here would legitimately resolve to REACH.)
        leadRow({ campaign_name: "Untagged Campaign", result_type: "", results: "0", spend: "50", reach: "0" }),
      ],
      now: NOW,
    });

    // $100 (Website Leads campaign's own spend) / 5 = $20.00 — the
    // untagged row's $50 never counts toward this objective's own cost,
    // same per-objective-spend rule as everywhere else in this file.
    expect(data.periodRow.resultColumns).toEqual([
      { label: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", value: "5", cprValue: "$20.00" },
    ]);
  });

  it("an account with mixed objectives (Website Leads + Link Clicks) shows both column pairs, still no Results column", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        leadRow(),
        leadRow({ campaign_name: "Clicks Campaign", result_type: "Link Click", results: "8", spend: "40" }),
      ],
      now: NOW,
    });

    const labels = data.periodRow.resultColumns.map((c) => c.label).sort();
    expect(labels).toEqual(["LINK CLICKS", "WEBSITE LEADS"]);
  });

  it("an account with only Purchases shows Purchases + Cost Per Purchase only", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [leadRow({ campaign_name: "Purchases Campaign", result_type: "Purchase", results: "3", spend: "300" })],
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toEqual([
      { label: "PURCHASES", costLabel: "COST PER PURCHASE", value: "3", cprValue: "$100.00" },
    ]);
  });

  it("falls back to showing the (0-count) group rather than an empty resultColumns array when every objective genuinely has 0 results", () => {
    // Real spend, but nothing converted yet for any objective — the table
    // must still render a valid column pair (fillCombinedTotalTable
    // requires at least one), not an empty, structurally-invalid grid.
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [leadRow({ result_type: "Website lead", results: "0" })],
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toHaveLength(1);
    expect(data.periodRow.resultColumns[0].label).toBe("WEBSITE LEADS");
    expect(data.periodRow.resultColumns[0].value).toBe("0");
  });
});

// Regression tests for the reported bug: the Combined Total table was
// showing LANDING PAGE VIEWS instead of WEBSITE LEADS for a campaign that
// had both a landing_page_view result_type AND real Website leads column
// data — Website leads is the actual conversion being optimized for, and
// must win over the intermediate landing_page_view signal. Fixed via
// objective.ts's resolveObjective: a dedicated metric column with a real
// non-zero value (Priority 1) now outranks result_type text (Priority 2).
describe("computeTableRow — objective Priority 1 column-value detection (reported Combined Total table bug)", () => {
  function bugRow(overrides: Partial<NreRow> = {}): NreRow {
    return {
      _raw: {},
      campaign_name: "Retargeting Campaign",
      ad_set_name: "Set 1",
      result_type: "",
      spend: "100",
      reach: "0",
      impressions: "9000",
      results: "0",
      ctr: "1.5",
      cpc: "6",
      date_start: "01-06-2026",
      date_end: "30-06-2026",
      ...overrides,
    };
  }

  it("Test 1 — website leads column (value 5) beats result_type = 'landing_page_view'", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [bugRow({ result_type: "landing_page_view", website_leads: "5", results: "5", spend: "100" })],
      now: NOW,
    });

    const labels = data.periodRow.resultColumns.map((c) => c.label);
    expect(labels).toContain("WEBSITE LEADS");
    expect(labels).not.toContain("LANDING PAGE VIEWS");
    expect(data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("5");
  });

  it("Test 2 — leads column (value 14) + result_type 'onsite_conversion.lead_grouped' -> META FORM LEADS", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        bugRow({
          campaign_name: "Lead Gen Campaign",
          result_type: "onsite_conversion.lead_grouped",
          leads: "14",
          results: "14",
          spend: "596",
        }),
      ],
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toEqual([
      { label: "META FORM LEADS", costLabel: "COST PER LEAD", value: "14", cprValue: "$42.57" },
    ]);
  });

  it("Test 3 — a Reach campaign with no conversion columns -> REACH", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        bugRow({ campaign_name: "Awareness Campaign", result_type: "Reach", reach: "20000", results: "0", spend: "400" }),
      ],
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toHaveLength(1);
    expect(data.periodRow.resultColumns[0].label).toBe("REACH");
  });

  it("Test 4 — mixed account (Reach + Meta Form Leads + Website Leads) shows three separate objective columns, each correctly identified", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        bugRow({ campaign_name: "Awareness", result_type: "Reach", reach: "20000", results: "0", spend: "400" }),
        bugRow({ campaign_name: "Meta Leads", leads: "14", results: "14", spend: "596" }),
        bugRow({ campaign_name: "Website Leads", website_leads: "9", results: "9", spend: "155" }),
      ],
      now: NOW,
    });

    const labels = data.periodRow.resultColumns.map((c) => c.label).sort();
    expect(labels).toEqual(["META FORM LEADS", "REACH", "WEBSITE LEADS"]);
  });

  it("Test 5 — website leads at 0 shows 0/N/A, meta form leads at 14 shows its own $42.57 cost per lead", () => {
    // A real CSV export carries the same header row for every campaign —
    // the Website Leads campaign's own "Website leads" column (Priority 3)
    // is what classifies it even though this period's value is 0.
    const sharedHeaders = { Leads: "0", "Website leads": "0" };
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        bugRow({
          campaign_name: "Meta Leads",
          _raw: { ...sharedHeaders, Leads: "14" },
          leads: "14",
          results: "14",
          spend: "596",
        }),
        bugRow({
          campaign_name: "Website Leads",
          _raw: { ...sharedHeaders, "Website leads": "0" },
          website_leads: "0",
          results: "0",
          spend: "155",
        }),
      ],
      now: NOW,
    });

    const metaLeads = data.periodRow.resultColumns.find((c) => c.label === "META FORM LEADS");
    const websiteLeads = data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(metaLeads).toEqual({ label: "META FORM LEADS", costLabel: "COST PER LEAD", value: "14", cprValue: "$42.57" });
    expect(websiteLeads).toEqual({ label: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", value: "0", cprValue: "N/A" });
  });

  it("is deterministic — repeated builds of the same reported-bug CSV input always classify identically", () => {
    const buildOnce = () =>
      buildReportData({
        accountName: "Test Agency",
        currencySymbol: "$",
        timezone: "Asia/Kolkata",
        monthlyBudget: null,
        mtdDailyRows,
        periodRows: [bugRow({ result_type: "landing_page_view", website_leads: "5", results: "5", spend: "100" })],
        now: NOW,
      }).periodRow.resultColumns;

    const first = buildOnce();
    for (let i = 0; i < 5; i++) {
      expect(buildOnce()).toEqual(first);
    }
  });
});

// Reported bug: a CSV with result_type = "Leads (form)" (Meta's own
// human-readable export text, capital L) but no dedicated "on-facebook
// leads"/"leads forms" column used to fall through to a generic RESULTS
// card instead of META FORM LEADS, because result-type-map.ts only had the
// machine-readable "onsite_conversion.lead_grouped" variant mapped. Fixed
// by adding a "leads (form)" entry (case-insensitively matched against
// both "leads (form)" and "Leads (form)") plus a dedicated-column-first
// check in slot-assignment.ts's buildMetaSlots — this is the exact
// campaign-slide card data (slots 4/5) the Metric Review wizard step's
// pre-selected cards are built from (available-metrics.ts's
// defaultMetaSelection mirrors this same logic, covered separately in
// available-metrics.test.ts).
describe("buildReportData — META FORM LEADS from result_type 'Leads (form)', no dedicated column (reported bug)", () => {
  it("Results=5, Cost per result=$40 (spend $200 / 5) -> campaign slide cards show META FORM LEADS=5 and COST PER LEAD=$40.00, not a generic RESULTS fallback", () => {
    // Campaign summary slides (and the Metric Review wizard step's
    // pre-selected default, which mirrors this same slot logic) are built
    // from the MTD dataset, not the weekly periodRows — see the existing
    // "Leads (form) + Website subscriptions campaigns" describe block above
    // for the same mtdDailyRows-only pattern.
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [
        {
          _raw: {},
          campaign_name: "Form Leads Campaign",
          ad_set_name: "Set 1",
          result_type: "Leads (form)",
          spend: "200",
          reach: "0",
          impressions: "9000",
          results: "5",
          ctr: "1.5",
          cpc: "6",
          date_start: "19-07-2026",
          date_end: "19-07-2026",
        },
      ],
      now: NOW,
    });

    const slide = data.campaignSlides.find((s) => s.campaignName === "Form Leads Campaign")!;
    expect(slide.resultLabel).toBe("META FORM LEADS");
    expect(slide.costLabel).toBe("COST PER LEAD");
    expect(slide.dynamicMetrics[3]).toMatchObject({ key: "results", label: "META FORM LEADS", value: "5" });
    expect(slide.dynamicMetrics[4]).toMatchObject({ key: "cost_per_result", label: "COST PER LEAD", value: "$40.00" });
  });

  // Reported follow-up bug: a real InstantForms campaign, spread across a
  // full weekly window, with a "Cost per lead" column present (column V —
  // real Meta export) but no "on-facebook leads" column. Before this fix,
  // the Metric Cards screen's pre-selection could fall back to a generic
  // objective's own cards (CPM/Frequency/Link Clicks — the REACH case's
  // slot 4/5/7) instead of META FORM LEADS/COST PER LEAD.
  it("InstantForms campaign: Results 1,2,6,7,4,3,2 (sum 25) across the week, 'Cost per lead' column present, no 'on-facebook leads' column -> Slot 4 META FORM LEADS=25, Slot 5 COST PER LEAD from spend/leads, never CPM/Frequency/Link Clicks", () => {
    const dailyResults = [1, 2, 6, 7, 4, 3, 2]; // sums to 25, matching the reported values
    const days = daysInclusive(13, 19);
    const rows: NreRow[] = days.map((day, i) => ({
      _raw: { Day: day, "Cost per lead": "5.60" },
      campaign_name: "InstantForms Campaign",
      ad_set_name: "Set 1",
      result_type: "Leads (form)",
      spend: "20",
      reach: "500",
      impressions: "1000",
      results: String(dailyResults[i]),
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });

    const slide = data.campaignSlides.find((s) => s.campaignName === "InstantForms Campaign")!;
    expect(slide.resultLabel).toBe("META FORM LEADS");
    expect(slide.costLabel).toBe("COST PER LEAD");
    // 7 days x $20 = $140 total spend; 25 total leads -> $5.60 per lead.
    expect(slide.dynamicMetrics[3]).toMatchObject({ key: "results", label: "META FORM LEADS", value: "25" });
    expect(slide.dynamicMetrics[4]).toMatchObject({ key: "cost_per_result", label: "COST PER LEAD", value: "$5.60" });
    // Never the generic Reach-objective fallback (CPM/Frequency) that was
    // the reported symptom.
    const slotLabels = [slide.dynamicMetrics[3]?.label, slide.dynamicMetrics[4]?.label];
    expect(slotLabels).not.toContain("CPM");
    expect(slotLabels).not.toContain("FREQUENCY");
    expect(slotLabels).not.toContain("LINK CLICKS");

    // The Metric Cards (Metric Review) wizard step's own pre-selected
    // default mirrors this exact slot logic (available-metrics.ts's
    // defaultMetaSelection) — same META FORM LEADS/COST PER LEAD pre-
    // selection, never a generic fallback, at the point in the wizard
    // before real aggregation exists.
    const headers = ["Campaign name", "Amount spent", "Reach", "Impressions", "Results", "Cost per lead", "CTR (All)"];
    const preview = defaultMetaSelection("META FORM LEADS", "COST PER LEAD", headers);
    expect(preview[3]).toMatchObject({ label: "META FORM LEADS" });
    expect(preview[4]).toMatchObject({ label: "COST PER LEAD" });
    const previewLabels = preview.map((m) => m.label);
    expect(previewLabels).not.toContain("CPM");
    expect(previewLabels).not.toContain("FREQUENCY");
    // No Link clicks column in this Instant Form preview — do not pre-select
    // a Link clicks chip the export never contained.
    expect(previewLabels).not.toContain("LINK CLICKS");
    expect(preview.map((m) => m.key)).not.toContain("link_clicks");
    expect(preview.map((m) => m.key)).not.toContain("cpc_link_click");
  });
});

// WYSIWYG fix — the wizard's own 8-metric Metric Cards selection (per-campaign
// override or the account-wide default) must reach the campaign slide exactly
// as shown on screen: same 8 keys, same order, no compaction, no shuffling, no
// padding from other CSV-detected candidates. A selected metric with no real
// data for this campaign dashes in its own fixed position rather than being
// dropped or replaced by an unrelated one (see computeMetaSlideMetrics in
// report-data.ts, which now calls buildSlotsFromSelection directly instead of
// redistributeCardSlots for this path).
describe("buildReportData — wizard metric selection reaches the campaign slide unchanged (WYSIWYG fix)", () => {
  const days = daysInclusive(13, 19);
  const dailyResults = [1, 2, 6, 7, 4, 3, 2]; // sums to 25
  // Real InstantForms export columns: Results, Cost per result, Amount
  // spent, Reach, Impressions, CTR, Link clicks, CPC (cost per link
  // click), Cost per lead — deliberately NO Website leads column, so
  // cost_per_lead's own perUnitOf: "website_leads" denominator has no
  // data on these rows (the bug computeMetaSlideMetrics' cost_per_lead
  // baseline alias now works around).
  const rows: NreRow[] = days.map((day, i) => ({
    _raw: { Day: day, "Cost per lead": "5.60", "CPC (cost per link click)": "0.85", "Link clicks": "4" },
    campaign_name: "InstantForms Campaign",
    ad_set_name: "Set 1",
    result_type: "Leads (form)",
    spend: "20",
    reach: "500",
    impressions: "1000",
    results: String(dailyResults[i]),
    link_clicks: "4",
    ctr: "1.5",
    cpc: "3",
    date_start: day,
    date_end: day,
  }));

  const EXPECTED_KEYS = [
    "spend",
    "reach",
    "impressions",
    "meta_form_leads",
    "cost_per_lead",
    "ctr",
    "link_clicks",
    "cpc_link_click",
  ];

  function selectionFor(): SelectedMetric[] {
    return [
      { key: "spend", label: "AD SPEND", format: "currency", csvName: "amount spent" },
      { key: "reach", label: "REACH", format: "number", csvName: "reach" },
      { key: "impressions", label: "IMPRESSIONS", format: "number", csvName: "impressions" },
      { key: "meta_form_leads", label: "META FORM LEADS", format: "number", csvName: "results" },
      { key: "cost_per_lead", label: "COST PER LEAD", format: "currency", csvName: "cost per lead" },
      { key: "ctr", label: "CTR (ALL)", format: "percentage", csvName: "ctr (all)" },
      { key: "link_clicks", label: "LINK CLICKS", format: "number", csvName: "link clicks" },
      { key: "cpc_link_click", label: "COST PER LINK CLICK", format: "currency", csvName: "cpc (cost per link click)" },
    ];
  }

  it("campaignMetricOverrides present (per-campaign override, as sent whenever the wizard's Metric Cards step has run) -> exactly these 8 keys, in order, no nulls, no cpc_all, cost_per_lead = spend/results not dash", () => {
    const selectedMetrics = selectionFor();
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedMetrics,
      campaignMetricOverrides: { "instantforms campaign": selectedMetrics.map((m) => m.key) },
      now: NOW,
    });

    const slide = data.campaignSlides.find((s) => s.campaignName === "InstantForms Campaign")!;
    const keys = slide.dynamicMetrics.map((m) => m?.key ?? null);
    expect(keys).toEqual(EXPECTED_KEYS);
    expect(slide.dynamicMetrics).toHaveLength(8);
    expect(slide.dynamicMetrics.some((m) => m === null)).toBe(false);
    expect(keys).not.toContain("cpc_all");
    // 7 days x $20 = $140 spend, 25 total leads -> $5.60/lead, never a dash.
    const costPerLead = slide.dynamicMetrics.find((m) => m?.key === "cost_per_lead");
    expect(costPerLead?.value).toBe("$5.60");
    expect(costPerLead?.value).not.toBe("—");
  });

  it("wizard's own untouched default selection (defaultMetaSelection, never edited by the user — the /metrics route auto-populates this for every campaign the moment Step 2 completes, and the wizard always sends it as that campaign's own override on generate, whether or not the user ever opened Step 4) -> the same 8 keys still reach the slide, still no dash", () => {
    // Deliberately NOT hand-typed — calls the real production function the
    // wizard's own /metrics route uses to pre-fill Step 4, so this is a
    // genuine "user clicked Continue without touching anything" selection,
    // not a stand-in for it.
    const headers = [
      "Campaign name",
      "Amount spent",
      "Reach",
      "Impressions",
      "Results",
      "Cost per lead",
      "CTR (All)",
      "Link clicks",
      "CPC (cost per link click)",
    ];
    const selectedMetrics = defaultMetaSelection("META FORM LEADS", "COST PER LEAD", headers);
    expect(selectedMetrics.map((m) => m.key)).toEqual(EXPECTED_KEYS);

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedMetrics,
      campaignMetricOverrides: { "instantforms campaign": selectedMetrics.map((m) => m.key) },
      now: NOW,
    });

    const slide = data.campaignSlides.find((s) => s.campaignName === "InstantForms Campaign")!;
    const keys = slide.dynamicMetrics.map((m) => m?.key ?? null);
    expect(keys).toEqual(EXPECTED_KEYS);
    expect(slide.dynamicMetrics).toHaveLength(8);
    expect(slide.dynamicMetrics.some((m) => m === null)).toBe(false);
    expect(keys).not.toContain("cpc_all");
    const costPerLead = slide.dynamicMetrics.find((m) => m?.key === "cost_per_lead");
    expect(costPerLead?.value).toBe("$5.60");
    expect(costPerLead?.value).not.toBe("—");
  });

  it("keeps Link clicks (dash) in slot 7 when that column is absent — never null, never cpc_all — even with extra unselected CSV columns", () => {
    const selectedMetrics = selectionFor();
    const rowsWithoutLinkClicks = rows.map((r) => {
      const { "Link clicks": _drop, ...raw } = r._raw;
      return { ...r, _raw: raw, link_clicks: "" };
    });
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rowsWithoutLinkClicks,
      selectedMetrics: [
        ...selectedMetrics,
        { key: "cpc_all", label: "CPC (ALL)", format: "currency", csvName: "cpc (all)" },
        { key: "frequency", label: "FREQUENCY", format: "ratio", csvName: "frequency" },
        { key: "landing_page_views", label: "LANDING PAGE VIEWS", format: "number", csvName: "landing page views" },
      ],
      campaignMetricOverrides: { "instantforms campaign": EXPECTED_KEYS },
      now: NOW,
    });
    const slide = data.campaignSlides.find((s) => s.campaignName === "InstantForms Campaign")!;
    const keys = slide.dynamicMetrics.map((m) => m?.key ?? null);
    expect(keys).toEqual(EXPECTED_KEYS);
    expect(slide.dynamicMetrics[6]).toMatchObject({ key: "link_clicks", label: "LINK CLICKS", value: "—" });
    expect(keys).not.toContain("cpc_all");
    expect(keys).not.toContain("frequency");
  });

  it("uses campaignMetricOverrides order, not the account-wide selectedMetrics union order", () => {
    const selectedMetrics = selectionFor();
    const scrambledUnion = [
      selectedMetrics[0],
      selectedMetrics[1],
      selectedMetrics[2],
      selectedMetrics[3],
      selectedMetrics[4],
      selectedMetrics[5],
      { key: "cpc_all", label: "CPC (ALL)", format: "currency" as const, csvName: "cpc (all)" },
      selectedMetrics[7],
      selectedMetrics[6],
    ];
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedMetrics: scrambledUnion,
      campaignMetricOverrides: { "instantforms campaign": EXPECTED_KEYS },
      now: NOW,
    });
    const slide = data.campaignSlides.find((s) => s.campaignName === "InstantForms Campaign")!;
    expect(slide.dynamicMetrics.map((m) => m?.key)).toEqual(EXPECTED_KEYS);
  });
});

// Real-account bug report: the Previous Month row's PURCHASES column was
// inflated by secondary/incidental purchases from a campaign whose real
// objective was Initiate Checkout, because a blank result_type + a
// non-zero Purchases column used to win unconditionally — Initiate
// Checkout was never even considered as a competing signal.
describe("computeTableRow (via periodRow) — Purchases vs Initiate Checkout column disambiguation (Part 6 bug fix)", () => {
  it("Campaign 1 (blank result_type, IC 4 > Purchases 2 secondary) -> INITIATE CHECKOUT column = 4; Campaign 2 (result_type 'Website purchases', Purchases 1) -> PURCHASES column = 1, never combined", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows: [
        {
          _raw: { "Initiate checkout": "4" },
          campaign_name: "Purchase_Catalog_BOF",
          ad_set_name: "Set 1",
          result_type: "",
          spend: "300",
          reach: "5000",
          impressions: "12000",
          results: "4",
          purchases: "2",
          ctr: "1.5",
          cpc: "3",
          date_start: "01-06-2026",
          date_end: "30-06-2026",
        },
        {
          _raw: {},
          campaign_name: "Purchase_Remarketing",
          ad_set_name: "Set 1",
          result_type: "Website purchases",
          spend: "60",
          reach: "1000",
          impressions: "2500",
          results: "1",
          purchases: "1",
          ctr: "2",
          cpc: "2",
          date_start: "01-06-2026",
          date_end: "30-06-2026",
        },
      ],
      now: NOW,
    });

    const initiateCheckout = data.periodRow.resultColumns.find((c) => c.label === "INITIATE CHECKOUT");
    const purchases = data.periodRow.resultColumns.find((c) => c.label === "PURCHASES");
    expect(initiateCheckout?.value).toBe("4");
    expect(purchases?.value).toBe("1"); // never 3 — Campaign 1's 2 secondary purchases must not bleed into this bucket.
    expect(data.periodRow.spend).toBe("$360"); // Ad Spend is still the full combined total of both campaigns.
  });
});

// Real-account bug report (MTD row specifically, not Previous Month): a
// single MTD campaign with two ad sets — one whose OWN per-day/per-ad-set
// aggregation resolves to INITIATE CHECKOUT (blank result_type, real
// Initiate Checkout column data, zero real purchases), one whose own
// aggregation resolves to PURCHASES (explicit "Website purchases" result_type,
// real purchases). The CAMPAIGN as a whole is assigned PURCHASES (explicit
// text wins). Before this fix, the MTD row's PURCHASES column summed BOTH
// ad sets' own `results` values (the IC ad set's own Initiate Checkout count
// included), showing 15 when the CSV only had 3 actual purchases across the
// period.
describe("computeTableRow (via mtdRow) — a campaign's mismatched ad set never inflates the MTD row's Purchases count (MTD-row bug fix)", () => {
  it("MTD row shows exactly 3 purchases, not 15 (12 real Initiate Checkouts + 3 real purchases)", () => {
    // 12 Initiate Checkouts (blank result_type, no real purchases) spread
    // across the 7-day window — its own aggregation resolves this ad set to
    // INITIATE CHECKOUT.
    const icAdSetRows: NreRow[] = daysInclusive(13, 19).map((day, i) => ({
      _raw: { Day: day, "Initiate checkout": String(i < 5 ? 2 : 1) }, // 2+2+2+2+2+1+1 = 12
      campaign_name: "Purchase Campaign",
      ad_set_name: "Prospecting - IC",
      result_type: "",
      spend: "10",
      reach: "200",
      impressions: "400",
      results: String(i < 5 ? 2 : 1),
      purchases: "0",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    // 3 real purchases, explicit result_type text — its own aggregation
    // resolves this ad set to PURCHASES.
    const purchaseAdSetRows: NreRow[] = daysInclusive(13, 19).map((day, i) => ({
      _raw: {},
      campaign_name: "Purchase Campaign",
      ad_set_name: "Retargeting - Purchases",
      result_type: "Website purchases",
      spend: "20",
      reach: "300",
      impressions: "600",
      results: String(i < 3 ? 1 : 0), // 1+1+1+0+0+0+0 = 3
      purchases: String(i < 3 ? 1 : 0),
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...icAdSetRows, ...purchaseAdSetRows],
      now: NOW,
    });

    const purchases = data.mtdRow.resultColumns.find((c) => c.label === "PURCHASES");
    expect(data.mtdRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
    // NOT 15 (12 Initiate Checkouts + 3 purchases) — the exact reported bug.
    expect(purchases?.value).toBe("3");
  });
});

// Real-account bug report: the MTD donut chart slide showed "ADD TO CART" /
// "COST PER ADD TO CART" for a genuine purchase campaign instead of
// "PURCHASES" / "COST PER PURCHASE". Root cause: the chart's own
// per-campaign label used to be a private port of addVisualScorecardSlide_'s
// detection — getResultLabels() on just the FIRST ad-set-group's own
// result_type, entirely independent of campaignObjectiveMap (the single
// source of truth campaign/ad-set slides and the Combined Total table
// already read from). A campaign whose FIRST-iterated ad set individually
// resolved to ADD TO CART (blank result_type, real Add To Cart data) but
// whose OTHER ad set had explicit "Website purchases" text — making
// campaignObjectiveMap correctly assign the whole campaign PURCHASES via
// Step 0's "any row" rule — showed the wrong, first-row-only label on the
// chart, even though its own campaign slide correctly showed PURCHASES.
describe("chart slide — reads resultLabel/costLabel from campaignObjectiveMap, not its own first-ad-set-only detection (reported chart bug)", () => {
  it("campaignObjectiveMap says PURCHASES -> chart shows PURCHASES/COST PER PURCHASE, not ADD TO CART/COST PER ADD TO CART", () => {
    // Listed FIRST in mtdDailyRows so its AggRow is chartGroups[name][0] —
    // the exact row the OLD buggy detection read from exclusively.
    const atcAdSetRows: NreRow[] = daysInclusive(13, 19).map((day) => ({
      _raw: { Day: day, "Adds to cart": "1" },
      campaign_name: "Purchase Campaign",
      ad_set_name: "Prospecting - ATC",
      result_type: "",
      spend: "10",
      reach: "200",
      impressions: "400",
      results: "1",
      purchases: "0",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    const purchaseAdSetRows: NreRow[] = daysInclusive(13, 19).map((day, i) => ({
      _raw: {},
      campaign_name: "Purchase Campaign",
      ad_set_name: "Retargeting - Purchases",
      result_type: "Website purchases",
      spend: "20",
      reach: "300",
      impressions: "600",
      results: String(i < 3 ? 1 : 0),
      purchases: String(i < 3 ? 1 : 0),
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...atcAdSetRows, ...purchaseAdSetRows],
      now: NOW,
    });

    const chartCampaign = data.chart!.campaigns.find((c) => c.name === "Purchase Campaign");
    expect(chartCampaign?.resLabel).toBe("PURCHASES");
    expect(chartCampaign?.cprLabel).toBe("COST PER PURCHASE");
    expect(chartCampaign?.resLabel).not.toBe("ADD TO CART");
    expect(chartCampaign?.cprLabel).not.toBe("COST PER ADD TO CART");

    // The chart's own resultLabel must also agree with what the SAME
    // campaign's own slide shows — no more chart/slide disagreement.
    const campaignSlide = data.campaignSlides.find((s) => s.campaignName === "Purchase Campaign");
    expect(campaignSlide?.resultLabel).toBe(chartCampaign?.resLabel);
  });

  it("per-campaign purchase counts use objective-specific totals, not summed generic results", () => {
    const icAdSetRows: NreRow[] = daysInclusive(13, 19).map((day, i) => ({
      _raw: { Day: day, "Initiate checkout": String(i < 5 ? 2 : 1) },
      campaign_name: "Purchase Campaign",
      ad_set_name: "TOF | Broad",
      result_type: "",
      spend: "10",
      reach: "200",
      impressions: "400",
      results: String(i < 5 ? 2 : 1),
      purchases: "0",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));
    const purchaseAdSetRows: NreRow[] = daysInclusive(13, 19).map((day, i) => ({
      _raw: {},
      campaign_name: "Purchase Campaign",
      ad_set_name: "Retargeting",
      result_type: "Website purchases",
      spend: "20",
      reach: "300",
      impressions: "600",
      results: String(i < 3 ? 1 : 0),
      purchases: String(i < 3 ? 1 : 0),
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: [...icAdSetRows, ...purchaseAdSetRows],
      now: NOW,
    });
    const chartCampaign = data.chart!.campaigns.find((c) => c.name === "Purchase Campaign");
    expect(chartCampaign?.resLabel).toBe("PURCHASES");
    expect(chartCampaign?.results).toBe(3);
  });
});

// Comparison Reports had their own separate objective-detection logic
// (pickPrimaryGroup, independently re-detecting each PERIOD's own
// objective) — same audit, same fix: now reads from a campaignObjectiveMap
// built once from both periods' combined rows.
describe("buildComparisonReportData — reads campaign objectives from a single campaignObjectiveMap, not independent per-period re-detection", () => {
  it("a campaign with a mismatched ad set in Period A doesn't have that ad set's own count summed into the wrong objective bucket", () => {
    // Period A (13-16 July): one ad set individually leans Initiate
    // Checkout (blank result_type, real IC data), another has the explicit
    // "Website purchases" text that makes the WHOLE campaign (Steps 0)
    // resolve PURCHASES.
    const icRows: NreRow[] = ["13-07-2026", "14-07-2026", "15-07-2026", "16-07-2026"].map((day) => ({
      _raw: { "Initiate checkout": "3" },
      campaign_name: "Comparison Campaign",
      ad_set_name: "Prospecting - IC",
      result_type: "",
      spend: "10",
      reach: "200",
      impressions: "400",
      results: "3",
      purchases: "0",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));
    const purchaseRows: NreRow[] = ["13-07-2026", "14-07-2026"].map((day) => ({
      _raw: {},
      campaign_name: "Comparison Campaign",
      ad_set_name: "Retargeting - Purchases",
      result_type: "Website purchases",
      spend: "20",
      reach: "300",
      impressions: "600",
      results: "1",
      purchases: "1",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    }));

    const data = buildComparisonReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      mtdDailyRows: [...icRows, ...purchaseRows],
      periodA: { startIso: "2026-07-13", endIso: "2026-07-16" },
      periodB: { startIso: "2026-07-17", endIso: "2026-07-19" },
      now: NOW,
    });

    const campaign = data.campaigns.find((c) => c.campaignName === "Comparison Campaign");
    expect(campaign?.objective).toBe("PURCHASES");
    expect(campaign?.costLabel).toBe("COST PER PURCHASE");
    // NOT 14 (12 Initiate Checkouts across 4 days + 2 real purchases) — only
    // the 2 real purchases count.
    expect(campaign?.metricsA.results.value).toBe(2);
  });
});

// Comprehensive regression test for the exact reported scenario: 3
// campaigns, 3 objectives, mixed spend — Meta Form Leads' Cost Per Lead
// must divide only its own $596 spend, never the $751 combined total.
describe("computeTableRow (via periodRow/mtdRow) — per-objective spend tracking, 3-campaign mixed-objective scenario", () => {
  it("Reach ($0, real reach numbers) + Meta Form Leads ($596, 14 leads) + Website Lead Forms ($155, 0 leads)", () => {
    const periodRows: NreRow[] = [
      {
        _raw: {},
        campaign_name: "Awareness Campaign",
        ad_set_name: "Set 1",
        result_type: "Reach",
        spend: "0",
        reach: "5000",
        impressions: "8000",
        results: "0",
        ctr: "0.5",
        cpc: "0",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      {
        _raw: {},
        campaign_name: "Meta Form Leads Campaign",
        ad_set_name: "Set 1",
        result_type: "Meta lead",
        spend: "596",
        reach: "4000",
        impressions: "9000",
        results: "14",
        ctr: "1.8",
        cpc: "5",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      {
        _raw: {},
        campaign_name: "Website Lead Forms Campaign",
        ad_set_name: "Set 1",
        result_type: "Website lead",
        spend: "155",
        reach: "2500",
        impressions: "5000",
        results: "0",
        ctr: "1.2",
        cpc: "4",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];

    const localMtdDailyRows: NreRow[] = periodRows.map((row) => ({
      ...row,
      _raw: { Day: "19-07-2026" },
      date_start: "19-07-2026",
      date_end: "19-07-2026",
    }));

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      now: NOW,
    });

    // Ad Spend is the TOTAL combined spend across all three objectives —
    // $0 + $596 + $155 = $751 — the overall-budget view, unaffected by the
    // per-objective cost fix.
    expect(data.periodRow.spend).toBe("$751");

    const metaFormLeads = data.periodRow.resultColumns.find((c) => c.label === "META FORM LEADS");
    expect(metaFormLeads?.value).toBe("14");
    // 596 / 14 = $42.57 — ONLY the Meta Form Leads campaign's own spend,
    // NOT 751 / 14 = $53.64 (what the old combined-total bug would show).
    expect(metaFormLeads?.cprValue).toBe("$42.57");
    expect(596 / 14).not.toBeCloseTo(751 / 14, 1);

    const websiteLeads = data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    // Real spend ($155), but zero results — the count is shown as 0 (not
    // hidden), and the cost is N/A (not a calculated number), per the
    // explicit "still show this objective column so the client can see the
    // spend existed" requirement.
    expect(websiteLeads?.value).toBe("0");
    expect(websiteLeads?.cprValue).toBe("N/A");

    // The Awareness/Reach campaign has $0 spend and 0 results in this
    // fixture (chosen so the combined total lands exactly on the reported
    // $751 — $0 + $596 + $155) — genuinely nothing to report for it, so it
    // earns no column of its own, same rule that drops the generic
    // "RESULTS" fallback bucket elsewhere in this file. A real Reach
    // campaign with actual spend/reach numbers gets its own Cost Per 1K
    // Reach column exactly like Meta Form Leads and Website Leads do here
    // — see the MTD row test above ("computes the MTD row...") for that
    // case with real Reach spend.
    expect(data.periodRow.resultColumns.some((c) => c.label === "REACH")).toBe(false);
    expect(data.periodRow.resultColumns).toHaveLength(2);

    // Chart snapshot uses multi-objective layout when 2+ objectives run.
    expect(data.chart?.snapshot.mode).toBe("multi");
    expect(data.chart?.snapshot.mtdSpendFormatted).toBe("$751");
    expect(data.chart?.snapshot.objectives).toHaveLength(2);
    const metaObj = data.chart?.snapshot.objectives.find((o) => o.label === "META FORM LEADS");
    const webObj = data.chart?.snapshot.objectives.find((o) => o.label === "WEBSITE LEADS");
    expect(metaObj?.resultsValue).toBe("14");
    expect(metaObj?.cprValue).toBe("$42.57");
    expect(metaObj?.spendFormatted).toBe("$596");
    expect(webObj?.resultsValue).toBe("0");
    expect(webObj?.cprValue).toBe("N/A");
    expect(webObj?.spendFormatted).toBe("$155");
  });

  it("keeps every distinct objective column pair, never dropping a live objective", () => {
    const periodRows: NreRow[] = [
      { _raw: {}, campaign_name: "A", ad_set_name: "Set 1", result_type: "Meta lead", spend: "596", reach: "1000", impressions: "2000", results: "14", ctr: "1", cpc: "1", date_start: "01-06-2026", date_end: "30-06-2026" },
      { _raw: {}, campaign_name: "B", ad_set_name: "Set 1", result_type: "Website lead", spend: "155", reach: "1000", impressions: "2000", results: "0", ctr: "1", cpc: "1", date_start: "01-06-2026", date_end: "30-06-2026" },
      { _raw: {}, campaign_name: "C", ad_set_name: "Set 1", result_type: "Reach", spend: "300", reach: "5000", impressions: "8000", results: "0", ctr: "1", cpc: "1", date_start: "01-06-2026", date_end: "30-06-2026" },
      { _raw: {}, campaign_name: "D", ad_set_name: "Set 1", result_type: "Purchase", spend: "50", reach: "500", impressions: "1000", results: "2", ctr: "1", cpc: "1", date_start: "01-06-2026", date_end: "30-06-2026" },
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows,
      now: NOW,
    });

    expect(data.periodRow.resultColumns).toHaveLength(4);
    const labels = data.periodRow.resultColumns.map((c) => c.label);
    expect(labels).toEqual(["META FORM LEADS", "REACH", "WEBSITE LEADS", "PURCHASES"]);
  });
});

// Reported bug fix: the Combined Total table used to re-detect objectives
// per ROW (column-level), so a secondary/minority signal within a single
// campaign (e.g. one ad set whose result_type read as an intermediate
// "landing_page_view" inside an otherwise Website-Leads campaign) could
// spawn its own phantom column, even though no campaign was ever built
// around that objective. The fix groups by CAMPAIGN first — each campaign
// gets exactly ONE detected objective (the same detection campaign slides
// already use), and its entire spend/results roll into that one bucket.
describe("computeTableRow (via periodRow/mtdRow) — campaign-level objective detection (reported Combined Total table bug)", () => {
  it("campaigns detected as [REACH, META FORM LEADS, WEBSITE LEADS] produce exactly those 3 columns — Landing Page Views never appears, even with real LP-view data inside the Website Leads campaign", () => {
    const periodRows: NreRow[] = [
      {
        _raw: {},
        campaign_name: "Awareness Campaign",
        ad_set_name: "Set 1",
        result_type: "Reach",
        spend: "400",
        reach: "20000",
        impressions: "30000",
        results: "0",
        ctr: "0.5",
        cpc: "0",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      {
        _raw: {},
        campaign_name: "Meta Leads Campaign",
        ad_set_name: "Set 1",
        result_type: "",
        leads: "14",
        spend: "596",
        reach: "4000",
        impressions: "9000",
        results: "14",
        ctr: "1.8",
        cpc: "5",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      // Website Leads campaign, ad set 1 — the campaign's real, dominant
      // objective: 20 website leads.
      {
        _raw: {},
        campaign_name: "Website Leads Campaign",
        ad_set_name: "Prospecting",
        result_type: "",
        website_leads: "20",
        spend: "200",
        reach: "3000",
        impressions: "6000",
        results: "20",
        ctr: "1.2",
        cpc: "4",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
      // Same campaign, a DIFFERENT ad set — no website_leads value here,
      // just real Landing Page Views data. Row-level detection alone would
      // call this ad set "LANDING PAGE VIEWS"; campaign-level detection
      // must fold it into the campaign's own dominant WEBSITE LEADS bucket.
      {
        _raw: {},
        campaign_name: "Website Leads Campaign",
        ad_set_name: "Retargeting",
        result_type: "",
        landing_page_views: "8",
        spend: "10",
        reach: "500",
        impressions: "1000",
        results: "0",
        ctr: "0.9",
        cpc: "1",
        date_start: "01-06-2026",
        date_end: "30-06-2026",
      },
    ];

    // A local MTD fixture with the SAME 3 campaigns/objectives (not the
    // shared module-level mtdDailyRows, which has its own unrelated Reach +
    // Purchases campaigns) — both rows agreeing on the objective mix keeps
    // this test focused on the campaign-level grouping fix, not the
    // separate MTD-vs-Period header-union behavior tested elsewhere.
    const localMtdDailyRows: NreRow[] = [
      ...buildDailyRows({
        campaign_name: "Awareness Campaign",
        ad_set_name: "Set 1",
        result_type: "Reach",
        spend: 57,
        reach: 20000,
        impressions: 30000,
        results: 0,
        link_clicks: 0,
        ctr: 0.5,
        cpc: 0,
        frequency: 1,
      }),
      ...buildDailyRows({
        campaign_name: "Meta Leads Campaign",
        ad_set_name: "Set 1",
        result_type: "Meta lead",
        spend: 85,
        reach: 4000,
        impressions: 9000,
        results: 2,
        link_clicks: 40,
        ctr: 1.8,
        cpc: 5,
        frequency: 1,
      }),
      ...buildDailyRows({
        campaign_name: "Website Leads Campaign",
        ad_set_name: "Prospecting",
        result_type: "Website lead",
        spend: 30,
        reach: 3000,
        impressions: 6000,
        results: 3,
        link_clicks: 20,
        ctr: 1.2,
        cpc: 4,
        frequency: 1,
      }),
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      now: NOW,
    });

    const labels = data.periodRow.resultColumns.map((c) => c.label).sort();
    expect(labels).toEqual(["META FORM LEADS", "REACH", "WEBSITE LEADS"]);
    expect(labels).not.toContain("LANDING PAGE VIEWS");
    expect(data.periodRow.resultColumns).toHaveLength(3);

    // Website-leads rows only — minority LPV ad-set spend does not inflate CPR.
    const websiteLeads = data.periodRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(websiteLeads?.value).toBe("20");
    expect(websiteLeads?.cprValue).toBe("$10.00"); // 200 / 20 — not (200 + 10) / 20

    // Header labels (shared by both rows) also reflect exactly these 3,
    // never a 4th Landing Page Views column.
    expect(data.tableHeaderLabels.resultColumns.map((c) => c.label).sort()).toEqual([
      "META FORM LEADS",
      "REACH",
      "WEBSITE LEADS",
    ]);
  });
});

// Permanent architectural fix: campaign slides and the Combined Total table
// now both read from the SAME campaignObjectiveMap (see report-data.ts's own
// Step 0 and objective.ts's buildCampaignObjectiveMap) instead of each
// independently re-detecting a campaign's objective, which could disagree.
describe("buildReportData — single source of truth for campaign objective detection (campaign slides vs. Combined Total table)", () => {
  it("5-campaign mixed-objective scenario — every campaign slide's own objective matches what the Combined Total table shows for that campaign", () => {
    const localMtdDailyRows: NreRow[] = [
      ...buildDailyRows({ campaign_name: "Campaign 1", ad_set_name: "Set 1", result_type: "Purchase", spend: 50, reach: 1000, impressions: 2000, results: 2, link_clicks: 20, ctr: 1, cpc: 1, frequency: 1 }),
      ...buildDailyRows({ campaign_name: "Campaign 2", ad_set_name: "Set 1", result_type: "Purchase", spend: 40, reach: 900, impressions: 1800, results: 1, link_clicks: 15, ctr: 1, cpc: 1, frequency: 1 }),
      ...buildDailyRows({ campaign_name: "Campaign 3", ad_set_name: "Set 1", result_type: "Leads (form)", spend: 30, reach: 800, impressions: 1600, results: 5, link_clicks: 10, ctr: 1, cpc: 1, frequency: 1 }),
      ...buildDailyRows({ campaign_name: "Campaign 4", ad_set_name: "Set 1", result_type: "Website lead", spend: 20, reach: 700, impressions: 1400, results: 4, link_clicks: 8, ctr: 1, cpc: 1, frequency: 1 }),
      ...buildDailyRows({ campaign_name: "Campaign 5", ad_set_name: "Set 1", result_type: "Landing page view", spend: 10, reach: 600, impressions: 1200, results: 0, link_clicks: 5, ctr: 1, cpc: 1, frequency: 1 }),
    ];

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      now: NOW,
    });

    // Every campaign gets its own slide (all 5 have real spend), each
    // showing its own campaign-level objective — Campaign 1 and Campaign 2
    // independently resolve to the SAME objective (PURCHASES).
    const slideLabels = new Map(data.campaignSlides.map((s) => [s.campaignName, s.resultLabel]));
    expect(slideLabels.get("Campaign 1")).toBe("PURCHASES");
    expect(slideLabels.get("Campaign 2")).toBe("PURCHASES");
    expect(slideLabels.get("Campaign 3")).toBe("META FORM LEADS");
    expect(slideLabels.get("Campaign 4")).toBe("WEBSITE LEADS");
    expect(slideLabels.get("Campaign 5")).toBe("LANDING PAGE VIEWS");

    // The Combined Total table's MTD row keeps every distinct reported
    // objective (4 here), including the lowest-spend Landing Page Views.
    const tableLabels = data.mtdRow.resultColumns.map((c) => c.label);
    expect(tableLabels).toEqual(["PURCHASES", "META FORM LEADS", "WEBSITE LEADS", "LANDING PAGE VIEWS"]);

    // No phantom objective: every column label the table actually shows is
    // also some campaign's own slide-level objective — the table never
    // shows a label no campaign slide agrees with.
    for (const label of tableLabels) {
      expect([...slideLabels.values()]).toContain(label);
    }

    // The PURCHASES column's numbers are the exact combined total of BOTH
    // campaigns that share it (2+1 results/day × 7 days = 21, ($50+$40)×7 =
    // $630 spend) — proving the table doesn't just match labels but also
    // correctly rolls both campaigns' totals into the one shared bucket.
    const purchases = data.mtdRow.resultColumns.find((c) => c.label === "PURCHASES");
    expect(purchases?.value).toBe("21");
    expect(purchases?.cprValue).toBe("$30.00"); // 630 / 21
  });

  // Part 6 bug fix — previously, a continuing campaign's Previous Month row
  // always re-detected its objective purely from last month's own (often
  // blanker/staler) data, independently of whatever the current month
  // resolved — even for the exact same campaign. That let last month's row
  // disagree with this month's campaign slide/MTD row for one campaign
  // whose real objective never actually changed, purely because last
  // month's export happened to have weaker result_type/column signals. Now
  // a campaign name shared between campaignObjectiveMap (this month,
  // engine-detected + wizard-confirmed) and Previous Month Data always
  // takes the current month's resolved objective for BOTH rows.
  it("a campaign present in both months takes the CURRENT month's resolved objective for its Previous Month row too", () => {
    const periodRows: NreRow[] = buildDailyRows({
      campaign_name: "Seasonal Campaign",
      ad_set_name: "Set 1",
      result_type: "Reach",
      spend: 40,
      reach: 9000,
      impressions: 15000,
      results: 0,
      link_clicks: 0,
      ctr: 0.5,
      cpc: 0,
      frequency: 1,
    }).map((r) => ({ ...r, date_start: "01-06-2026", date_end: "07-06-2026" }));

    const localMtdDailyRows = buildDailyRows({
      campaign_name: "Seasonal Campaign",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: 60,
      reach: 5000,
      impressions: 10000,
      results: 3,
      link_clicks: 30,
      ctr: 1,
      cpc: 2,
      frequency: 1,
    });

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      now: NOW,
    });

    expect(data.periodRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
    expect(data.mtdRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
    expect(data.campaignSlides.find((s) => s.campaignName === "Seasonal Campaign")?.resultLabel).toBe("PURCHASES");
  });

  // The flip side of the fix above — a campaign that only exists in
  // Previous Month Data (paused, renamed, or otherwise absent from this
  // month's MTD CSV) has no current-month entry to prefer, so it still
  // resolves purely from its own data, exactly as before.
  it("a campaign present ONLY in Previous Month Data still resolves its own objective independently", () => {
    const periodRows: NreRow[] = buildDailyRows({
      campaign_name: "Retired Campaign",
      ad_set_name: "Set 1",
      result_type: "Reach",
      spend: 40,
      reach: 9000,
      impressions: 15000,
      results: 0,
      link_clicks: 0,
      ctr: 0.5,
      cpc: 0,
      frequency: 1,
    }).map((r) => ({ ...r, date_start: "01-06-2026", date_end: "07-06-2026" }));

    const localMtdDailyRows = buildDailyRows({
      campaign_name: "Unrelated Campaign",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: 60,
      reach: 5000,
      impressions: 10000,
      results: 3,
      link_clicks: 30,
      ctr: 1,
      cpc: 2,
      frequency: 1,
    });

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      now: NOW,
    });

    expect(data.periodRow.resultColumns.map((c) => c.label)).toEqual(["REACH"]);
    expect(data.mtdRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
  });

  // Objective Confirmation memory cache (Part 4) — a campaign present ONLY
  // in Previous Month Data (no current-month entry to prefer, same fixture
  // as the test right above) now checks the client's persisted objective
  // cache BEFORE falling back to independently re-detecting from last
  // month's own raw rows. A prior confirmation is a stronger signal than
  // re-detecting from what's often blanker/staler data.
  it("Objective Confirmation memory cache — a campaign present ONLY in Previous Month Data uses the client's cached objective instead of independently re-detecting", () => {
    const periodRows: NreRow[] = buildDailyRows({
      campaign_name: "Retired Campaign",
      ad_set_name: "Set 1",
      result_type: "Reach",
      spend: 40,
      reach: 9000,
      impressions: 15000,
      results: 0,
      link_clicks: 0,
      ctr: 0.5,
      cpc: 0,
      frequency: 1,
    }).map((r) => ({ ...r, date_start: "01-06-2026", date_end: "07-06-2026" }));

    const localMtdDailyRows = buildDailyRows({
      campaign_name: "Unrelated Campaign",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: 60,
      reach: 5000,
      impressions: 10000,
      results: 3,
      link_clicks: 30,
      ctr: 1,
      cpc: 2,
      frequency: 1,
    });

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      objectiveCache: {
        "retired campaign": { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
      },
      now: NOW,
    });

    // Without the cache entry this would resolve REACH (its own Reach
    // result_type — see the un-cached test right above) — the cache wins.
    expect(data.periodRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
  });

  // Priority ordering — a campaign present in BOTH this month's data and
  // the objective cache still prefers the CURRENT month's freshly-resolved
  // objective (Part 6's own fix, above) over the persisted cache: the cache
  // is only a fallback for a campaign with no current-month entry at all.
  it("Objective Confirmation memory cache — the current month's own resolved objective still wins over a stale cache entry for the same campaign", () => {
    const periodRows: NreRow[] = buildDailyRows({
      campaign_name: "Seasonal Campaign",
      ad_set_name: "Set 1",
      result_type: "Reach",
      spend: 40,
      reach: 9000,
      impressions: 15000,
      results: 0,
      link_clicks: 0,
      ctr: 0.5,
      cpc: 0,
      frequency: 1,
    }).map((r) => ({ ...r, date_start: "01-06-2026", date_end: "07-06-2026" }));

    const localMtdDailyRows = buildDailyRows({
      campaign_name: "Seasonal Campaign",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: 60,
      reach: 5000,
      impressions: 10000,
      results: 3,
      link_clicks: 30,
      ctr: 1,
      cpc: 2,
      frequency: 1,
    });

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      // A deliberately WRONG/stale cache entry for this campaign — should
      // never be reached, since campaignObjectiveMap (this month) already
      // has an entry for "seasonal campaign".
      objectiveCache: {
        "seasonal campaign": { resultLabel: "REACH", costLabel: "COST PER 1K REACH" },
      },
      now: NOW,
    });

    expect(data.periodRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
  });

  // Part 6 bug fix — the merge is keyed by normalizeCampaignName (trimmed,
  // lower-cased), same as every other campaignObjectiveMap lookup in this
  // codebase, so a Previous Month CSV exported with different capitalization
  // than the current month's still matches.
  it("matches the current month's campaign name case-insensitively", () => {
    const periodRows: NreRow[] = buildDailyRows({
      campaign_name: "seasonal CAMPAIGN", // different casing than the MTD row below
      ad_set_name: "Set 1",
      result_type: "Reach",
      spend: 40,
      reach: 9000,
      impressions: 15000,
      results: 0,
      link_clicks: 0,
      ctr: 0.5,
      cpc: 0,
      frequency: 1,
    }).map((r) => ({ ...r, date_start: "01-06-2026", date_end: "07-06-2026" }));

    const localMtdDailyRows = buildDailyRows({
      campaign_name: "Seasonal Campaign",
      ad_set_name: "Set 1",
      result_type: "Purchase",
      spend: 60,
      reach: 5000,
      impressions: 10000,
      results: 3,
      link_clicks: 30,
      ctr: 1,
      cpc: 2,
      frequency: 1,
    });

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: localMtdDailyRows,
      periodRows,
      now: NOW,
    });

    expect(data.periodRow.resultColumns.map((c) => c.label)).toEqual(["PURCHASES"]);
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

  // Fix 5 — a zero-spend current month must never look like the MTD row is
  // missing from the Combined Total table: even with zero MTD Daily CSV
  // rows at all (mtdDailyRows: []), the row still needs to show the real
  // current month's date range (derived from `now`), not a bare "—".
  it("still shows the real current-month date range on the MTD row even when mtdDailyRows is completely empty (Fix 5)", () => {
    const data = buildReportData({
      accountName: "Idle Co",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: [],
      now: NOW, // "2026-07-20T12:00:00Z" — current month is July, "yesterday" is July 19
    });
    expect(data.mtdRow.hasData).toBe(false);
    expect(data.mtdRow.monthLabel).not.toBe("—");
    expect(data.mtdRow.monthLabel).toBe("July 1 - 19");
    expect(data.mtdRow.fullMonthLabel).toBe("July 1 - July 19");
    expect(data.mtdRow.monthName).toBe("July");
    // Every other value stays 0/"—" — only the date label changes.
    expect(data.mtdRow.spend).toBe("—");
    expect(data.mtdRow.reach).toBe("—");
    // Never hidden: buildTableSlideXml's hideMtdRow only fires when both
    // rows share a month, which requires mtdRow.hasData — false here.
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(false);
  });
});

// Fix 6 — the visual chart slide must always reflect the CURRENT month's
// data, never previous month's, and must never silently drop a campaign
// that's in scope for this report just because it has zero MTD rows this
// calendar month. "Old Campaign" only ever ran in June and picks up its
// spend through a custom weekly range set entirely in June (so it's part of
// campaignNames, this report's own scope); "Active Campaign" has real July
// rows, which is what anchors "yesterday"/the MTD month to July (splitMtdDaily
// always tracks the CSV's own latest date) and keeps mtdRows non-empty. The
// result: mtdRows/chartGroups has an entry for "Active Campaign" but not for
// "Old Campaign" at all — exactly the shape a campaign that stopped
// delivering at the start of the new month would take in a real multi-
// campaign account's CSV.
// Objective Confirmation — the permanent objective-detection fix (Part 8's
// numbered test list, the buildReportData-level tests).
describe("buildReportData — Objective Confirmation (Part 8)", () => {
  function objRow(campaignName: string, resultType: string, resultsCount: number, spend: number): NreRow {
    return {
      _raw: {},
      campaign_name: campaignName,
      result_type: resultType,
      spend: String(spend),
      reach: "1000",
      impressions: "3000",
      results: String(resultsCount),
      ctr: "1.5",
      cpc: "2",
      date_start: "01-06-2026",
      date_end: "30-06-2026",
    } as unknown as NreRow;
  }

  it("Test 3 — a mixed account (Initiate Checkout + Purchases + Reach campaigns) gets 3 separate Combined Total columns; each objective's cost-per-result uses ONLY that objective's own spend", () => {
    const periodRows: NreRow[] = [
      objRow("IC Campaign", "initiate_checkout", 40, 400), // its own CPP = 400/40 = $10
      objRow("Purchases Campaign", "purchase", 20, 1000), // its own CPP = 1000/20 = $50
      objRow("Reach Campaign", "reach", 0, 50),
    ];
    const data = buildReportData({
      accountName: "Mixed Objective Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: [],
      periodRows,
      now: NOW,
    });

    const labels = data.periodRow.resultColumns.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["INITIATE CHECKOUT", "PURCHASES", "REACH"]));
    expect(labels).toHaveLength(3);

    const icColumn = data.periodRow.resultColumns.find((c) => c.label === "INITIATE CHECKOUT")!;
    const purchasesColumn = data.periodRow.resultColumns.find((c) => c.label === "PURCHASES")!;
    // Each objective's own cost-per-result — IC's $400 spend never leaks
    // into Purchases' own $1000/20 = $50.00 calculation (would be
    // ($400+$1000)/20 = $70.00 if the combined spend were wrongly used).
    expect(icColumn.value).toBe("40");
    expect(icColumn.cprValue).toBe("$10.00");
    expect(purchasesColumn.value).toBe("20");
    expect(purchasesColumn.cprValue).toBe("$50.00");
  });

  it("Test 6 — a user-confirmed objective override (campaignObjectives) wins over the engine's own detection for that campaign", () => {
    const mtdDays = daysInclusive(13, 19);
    const mtdDailyRows: NreRow[] = mtdDays.map(
      (day) =>
        ({
          _raw: { Day: day },
          campaign_name: "Checkout Campaign",
          result_type: "initiate_checkout",
          spend: "50",
          reach: "1000",
          impressions: "3000",
          results: "5",
          ctr: "1.5",
          cpc: "2",
          date_start: day,
          date_end: day,
        }) as unknown as NreRow,
    );

    // Without any override — engine detection wins (INITIATE CHECKOUT).
    const engineData = buildReportData({
      accountName: "Override Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows,
      now: NOW,
    });
    expect(engineData.mtdRow.resultColumns[0].label).toBe("INITIATE CHECKOUT");

    // With the Objective Confirmation step's user override — PURCHASES wins
    // for this campaign, for every consumer that reads campaignObjectiveMap
    // (the Combined Total table here; campaign/ad-set slides read the same
    // map — see report-data.ts's Step 0).
    const overriddenData = buildReportData({
      accountName: "Override Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows,
      now: NOW,
      campaignObjectives: {
        "checkout campaign": { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" },
      },
    });
    expect(overriddenData.mtdRow.resultColumns[0].label).toBe("PURCHASES");
    expect(overriddenData.mtdRow.resultColumns[0].costLabel).toBe("COST PER PURCHASE");
    // The campaign slide's own objective agrees with the table (single
    // source of truth — both read the same overridden campaignObjectiveMap).
    const slide = overriddenData.campaignSlides.find((s) => s.campaignName === "Checkout Campaign")!;
    expect(slide.resultLabel).toBe("PURCHASES");
  });
});

describe("buildReportData — chart slide with zero current-month spend (Fix 6)", () => {
  function dailyRow(campaignName: string, day: string, spend: number): NreRow {
    return {
      _raw: { Day: day },
      campaign_name: campaignName,
      ad_set_name: "Only Ad Set",
      result_type: "Purchase",
      spend: String(spend),
      reach: "500",
      impressions: "1000",
      results: "5",
      ctr: "1.5",
      cpc: "3",
      date_start: day,
      date_end: day,
    };
  }

  const juneDays = ["2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24", "2026-06-25", "2026-06-26"];
  const julyDays = daysInclusive(13, 19); // "13-07-2026".."19-07-2026" — the trailing-7-day window for NOW = 2026-07-20

  const rows: NreRow[] = [
    ...juneDays.map((day) => dailyRow("Old Campaign", day, 100)),
    ...julyDays.map((day) => dailyRow("Active Campaign", day, 200)),
  ];

  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "$",
    timezone: "UTC",
    monthlyBudget: null,
    mtdDailyRows: rows,
    weeklyRange: { startIso: "2026-06-20", endIso: "2026-06-26" }, // scopes campaignNames/weeklyRows to June, onto Old Campaign only
    now: NOW,
  });

  it("is not paused — the custom weekly window has real (June) spend", () => {
    expect(data.isPaused).toBe(false);
    expect(data.chart).not.toBeNull();
  });

  it("mtdRows (this calendar month) tracks July, not June — confirms the fixture actually reproduces the gap", () => {
    expect(data.mtdRow.hasData).toBe(true);
    expect(data.mtdRow.monthName).toBe("July");
  });

  it("still gives the June-only campaign its own $0 donut on the chart, instead of dropping it because MTD (July) has no rows for it", () => {
    const entry = data.chart!.campaigns.find((c) => c.name === "Old Campaign");
    expect(entry).toBeDefined();
    expect(entry!.spend).toBe(0);
    expect(entry!.results).toBe(0);
  });

  it("shows a $0 Total Month to Date Spend contribution from the June-only campaign, never June's real figure", () => {
    // Active Campaign's real July spend (7 days x $200 = $1400) is the only
    // contributor — Old Campaign's $700 June spend never leaks in.
    expect(data.chart!.totalAllSpend).toBe(1400);
  });

  it("shows the CURRENT month (July) on the chart sub-line and title, never June", () => {
    expect(data.chart!.mtdMonthName).toBe("July");
    expect(data.chart!.periodSubLabel).toContain("July");
    expect(data.chart!.periodSubLabel).not.toContain("June");
  });
});

describe("compactSameMonthRangeLabel (Fix 2, round 5) — Combined Total table's short date format", () => {
  it("compacts a same-month, multi-day range to 'Month D - D' (only one month name)", () => {
    expect(compactSameMonthRangeLabel("01-08-2026", "05-08-2026", "August")).toBe("August 1 - 5");
  });

  it("keeps the full 'Month D - Month D' form when start and end are in different months", () => {
    expect(compactSameMonthRangeLabel("30-07-2026", "05-08-2026", "August")).toBe("July 30 - August 5");
  });

  it("collapses to a single 'Month D' when start and end are the same day", () => {
    expect(compactSameMonthRangeLabel("15-08-2026", "15-08-2026", "August")).toBe("August 15");
  });

  it("keeps the full form across a year boundary too (December -> January)", () => {
    expect(compactSameMonthRangeLabel("29-12-2026", "03-01-2027", "January")).toBe("December 29 - January 3");
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
      fullMonthLabel: "Jul 1 - Jul 23",
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
    // has data for (13-19; the fixture doesn't include days 1-12), compacted
    // to the same-month short form (Fix 2, round 5).
    expect(data.mtdRow.monthLabel).toBe("July 13 - 19");
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

  it("keeps the 'Full Month [Year]' chart sub-line for Monthly reports", () => {
    const monthly = build("MONTHLY");
    expect(monthly.chart?.periodSubLabel).toBe("Full Month 2026");
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

describe("buildReportData — automatic 8-slot metric assignment (Change 2, no wizard input)", () => {
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

  it("always populates dynamicMetrics with exactly 8 entries, with no selectedMetrics input at all", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    const dynamicMetrics = data.campaignSlides[0].dynamicMetrics;
    expect(dynamicMetrics).toHaveLength(8);
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

  it("assigns slots 4/5/7 for the PURCHASES objective (Results/Cost per Purchase/ROAS), calculated from totals — not the CSV's own single-day ROAS column", () => {
    // ROAS must never be read straight off the CSV's own "Results roas"
    // column and averaged: only day 1 has a purchase (ROAS 17.62 that day,
    // 0 every other day), which is exactly the shape that makes a naive
    // "average of non-zero values" collapse to that one day's number. The
    // correct weekly ROAS is sum(conversion value)/sum(spend) across all 7
    // days: 881 / (50 * 7) = 2.517... -> "2.52x", not "17.62x".
    const purchaseRows = daysInclusive(13, 19).map((day, i) =>
      dynamicRow(day, 50, 500, 2, "Purchase", i === 0 ? { "Results roas": "17.62", "Purchases conversion value": "881" } : { "Results roas": "0" }),
    );
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
    expect(slots[6]).toMatchObject({ key: "results_roas", label: "ROAS", value: "2.52x" });
  });

  it("never falls back to the raw per-day ROAS figure when the CSV has a ROAS column but no conversion-value column — slot 7 is null (Round I: no metric name shown for data that isn't real), not the wrong 3.5x", () => {
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
    expect(slots[6]).toBeNull();
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

  it("assigns Reach defaults as frequency/CPM/CTR/CPC (all)/cost-per-1k — not LPV or link clicks", () => {
    const reachRows = daysInclusive(13, 19).map((day) =>
      dynamicRow(day, 50, 500, 2, "Reach", {
        "CPM (Cost per 1,000 Impressions)": "3",
        Frequency: "1.8",
        "CPC (all)": "0.42",
        "Link clicks": "10",
        "Landing page views": "1",
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
    expect(slots.map((s) => s?.key)).toEqual([
      "spend",
      "reach",
      "impressions",
      "frequency",
      "cpm",
      "ctr",
      "cpc_all",
      "cost_per_1k_reached",
    ]);
    expect(slots[3]).toMatchObject({ key: "frequency", label: "FREQUENCY", value: "1.80x" });
    expect(slots[4]).toMatchObject({ key: "cpm", label: "CPM" });
    expect(slots[6]).toMatchObject({ key: "cpc_all", label: "CPC (ALL)" });
    expect(slots.map((s) => s?.key)).not.toContain("landing_page_views");
    expect(slots.map((s) => s?.key)).not.toContain("link_clicks");
  });

  // Round I bug fix: previously this slot showed the case's own candidate
  // label (e.g. "ROAS") with a dash value — a metric name absent from the
  // CSV, shown anyway. Now it's null entirely (fill-tags.ts dashes out
  // both the label and the value for a null slot) since this CSV has none
  // of PURCHASES' own slot 7 candidate (Results ROAS) nor anything in the
  // global fallback chain (no Link Clicks/Clicks (All)/Frequency columns,
  // and no raw Impressions column either, so even CPM can't be computed).
  it("slot is null (not a dash-valued metric name) for an extra dictionary field that's zero or absent from the CSV — Round I", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows, // no "Link clicks"/"Results roas" raw columns at all
      now: NOW,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[6]).toBeNull();
  });

  it("never splits a campaign into a second/continued slide — a campaign always gets exactly one slide with the automatic 8-slot assignment", () => {
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
    expect(slidesForShoes[0].dynamicMetrics.length).toBe(8);
  });

  it("additionalMetricsSlide is undefined when no selectedMetrics is passed — regression guard for backward compatibility", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
    });
    expect(data.campaignSlides[0].additionalMetricsSlide).toBeUndefined();
  });
});

describe("buildReportData — Part 3/4: wizard selectedMetrics override + multi-slide", () => {
  function dynamicRow(day: string, spend: number, reach: number, ctr: number, resultType: string, extraRaw: Record<string, string> = {}): NreRow {
    return {
      _raw: { Day: day, "Amount spent": String(spend), Reach: String(reach), Impressions: "1000", "CTR (all)": String(ctr), ...extraRaw },
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

  const rows: NreRow[] = daysInclusive(13, 19).map((day) =>
    dynamicRow(day, 50, 500, 2, "Purchase", {
      "Link clicks": "10",
      "CPM (cost per 1,000 impressions)": "5",
      "Landing page views": "8",
      Views: "3",
      Frequency: "1.5",
    }),
  );

  const eightMetrics = [
    { key: "spend", label: "AD SPEND", format: "currency" as const, csvName: "amount spent" },
    { key: "reach", label: "REACH", format: "number" as const, csvName: "reach" },
    { key: "impressions", label: "IMPRESSIONS", format: "number" as const, csvName: "impressions" },
    { key: "results", label: "RESULTS", format: "number" as const, csvName: "results" },
    { key: "cost_per_result", label: "COST PER RESULT", format: "currency" as const, csvName: "cost per result" },
    { key: "ctr", label: "CTR (ALL)", format: "percentage" as const, csvName: "ctr (all)" },
    { key: "link_clicks", label: "LINK CLICKS", format: "number" as const, csvName: "link clicks" },
    { key: "cpc_all", label: "CPC (ALL)", format: "currency" as const, csvName: "cpc (all)" },
  ];

  it("uses the wizard's own selectedMetrics instead of the automatic assignment when 8 or fewer are given", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics: eightMetrics.slice(0, 5),
    });
    const slide = data.campaignSlides[0];
    expect(slide.dynamicMetrics.map((m) => m?.key)).toEqual(["spend", "reach", "impressions", "results", "cost_per_result"]);
    expect(slide.additionalMetricsSlide).toBeUndefined();
  });

  it("splits into a second 'Additional Metrics' slide when selectedMetrics exceeds 8", () => {
    const nineMetrics: SelectedMetric[] = [...eightMetrics, { key: "impressions", label: "IMPRESSIONS", format: "number" as const, csvName: "impressions" }];
    // Swap the 9th for a genuinely distinct key so slide 2 isn't empty after dedup expectations.
    nineMetrics[8] = { key: "frequency", label: "FREQUENCY", format: "ratio" as const, csvName: "frequency" };
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics: nineMetrics,
    });
    const slide = data.campaignSlides[0];
    expect(slide.dynamicMetrics).toHaveLength(8);
    expect(slide.additionalMetricsSlide).toBeDefined();
    expect(slide.additionalMetricsSlide!.map((m) => m?.key)).toEqual(["frequency", "results", "cost_per_result"]);
  });

  it("reuses the already-computed baseline value for a core key (spend) rather than re-deriving it from raw rows", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics: [eightMetrics[0]],
    });
    // 7 days * $50 = $350, same total the fixed metrics.spend field itself computes.
    expect(data.campaignSlides[0].dynamicMetrics[0]?.value).toBe(data.campaignSlides[0].metrics.spend);
  });
});

describe("buildReportData — Part 8: mixed-objective account, per-campaign metric filtering", () => {
  function objRow(day: string, campaign: string, resultType: string, extraRaw: Record<string, string> = {}): NreRow {
    return {
      _raw: { Day: day, "Amount spent": "50", Reach: "1000", Impressions: "10000", "CTR (all)": "2", ...extraRaw },
      campaign_name: campaign,
      ad_set_name: "Set 1",
      result_type: resultType,
      spend: "50",
      reach: "1000",
      impressions: "10000",
      results: "10",
      ctr: "2",
      cpc: "1",
      date_start: day,
      date_end: day,
    };
  }

  const days = daysInclusive(13, 19);
  const rows: NreRow[] = days.flatMap((day) => [
    objRow(day, "Lead Gen", "Leads (form)", { "Link clicks": "20", "Landing page views": "15" }),
    objRow(day, "Website Leads Co", "Website leads", { "Link clicks": "25", "Landing page views": "18" }),
  ]);

  const selectedMetrics: SelectedMetric[] = [
    { key: "spend", label: "AD SPEND", format: "currency", csvName: "amount spent" },
    { key: "reach", label: "REACH", format: "number", csvName: "reach" },
    { key: "impressions", label: "IMPRESSIONS", format: "number", csvName: "impressions" },
    { key: "meta_form_leads", label: "META FORM LEADS", format: "number", csvName: "results" },
    { key: "cost_per_meta_form_leads", label: "COST PER LEAD", format: "currency", csvName: "cost per result" },
    { key: "website_leads", label: "WEBSITE LEADS", format: "number", csvName: "results" },
    { key: "cost_per_website_leads", label: "COST PER WEBSITE LEAD", format: "currency", csvName: "cost per result" },
    { key: "ctr", label: "CTR (ALL)", format: "percentage", csvName: "ctr (all)" },
    { key: "link_clicks", label: "LINK CLICKS", format: "number", csvName: "link clicks" },
  ];

  function buildMixedData() {
    return buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives: {
        "Lead Gen": { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" },
        "Website Leads Co": { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" },
      },
    });
  }

  it("shows only its own objective's cards on each campaign's slide, never another campaign's", () => {
    const data = buildMixedData();
    const leadGen = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    const websiteLeads = data.campaignSlides.find((s) => s.campaignName === "Website Leads Co")!;

    const leadGenKeys = leadGen.dynamicMetrics.map((m) => m?.key);
    expect(leadGenKeys).toContain("meta_form_leads");
    expect(leadGenKeys).toContain("cost_per_meta_form_leads");
    expect(leadGenKeys).not.toContain("website_leads");
    expect(leadGenKeys).not.toContain("cost_per_website_leads");

    const websiteLeadsKeys = websiteLeads.dynamicMetrics.map((m) => m?.key);
    expect(websiteLeadsKeys).toContain("website_leads");
    expect(websiteLeadsKeys).toContain("cost_per_website_leads");
    expect(websiteLeadsKeys).not.toContain("meta_form_leads");
    expect(websiteLeadsKeys).not.toContain("cost_per_meta_form_leads");
  });

  it("resolves the synthetic per-objective card's own value from the already-objective-aware baseline, not a fresh raw-column re-aggregation", () => {
    const data = buildMixedData();
    const leadGen = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    const card = leadGen.dynamicMetrics.find((m) => m?.key === "meta_form_leads");
    // Reuses the same already-computed value the RESULTS/CPR display line
    // itself shows for this campaign — not a dash and not derived by
    // re-summing the raw "results" CSV column independently.
    expect(card?.value).toBe(leadGen.metrics.results);
    expect(card?.value).not.toBe("—");
  });
});

describe("buildReportData — Step 4 Section B: campaignMetricOverrides (final 5-step wizard)", () => {
  function objRow(day: string, campaign: string, resultType: string, extraRaw: Record<string, string> = {}): NreRow {
    return {
      _raw: { Day: day, "Amount spent": "50", Reach: "1000", Impressions: "10000", "CTR (all)": "2", ...extraRaw },
      campaign_name: campaign,
      ad_set_name: "Set 1",
      result_type: resultType,
      spend: "50",
      reach: "1000",
      impressions: "10000",
      results: "10",
      ctr: "2",
      cpc: "1",
      date_start: day,
      date_end: day,
    };
  }

  const days = daysInclusive(13, 19);
  const rows: NreRow[] = days.flatMap((day) => [
    objRow(day, "Lead Gen", "Leads (form)", { "Link clicks": "20", "Landing page views": "15" }),
    objRow(day, "Website Leads Co", "Website leads", { "Link clicks": "25", "Landing page views": "18" }),
  ]);

  const selectedMetrics: SelectedMetric[] = [
    { key: "spend", label: "AD SPEND", format: "currency", csvName: "amount spent" },
    { key: "reach", label: "REACH", format: "number", csvName: "reach" },
    { key: "impressions", label: "IMPRESSIONS", format: "number", csvName: "impressions" },
    { key: "meta_form_leads", label: "META FORM LEADS", format: "number", csvName: "results" },
    { key: "cost_per_meta_form_leads", label: "COST PER LEAD", format: "currency", csvName: "cost per result" },
    { key: "website_leads", label: "WEBSITE LEADS", format: "number", csvName: "results" },
    { key: "cost_per_website_leads", label: "COST PER WEBSITE LEAD", format: "currency", csvName: "cost per result" },
    { key: "ctr", label: "CTR (ALL)", format: "percentage", csvName: "ctr (all)" },
    { key: "link_clicks", label: "LINK CLICKS", format: "number", csvName: "link clicks" },
  ];

  const campaignObjectives = {
    "Lead Gen": { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" },
    "Website Leads Co": { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" },
  };

  it("a campaign present in campaignMetricOverrides gets exactly that card list — a hard replacement, not an additional filter on top of the automatic per-objective narrowing", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides: {
        "Lead Gen": ["spend", "reach", "ctr", "link_clicks"],
      },
    });
    const leadGen = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    const leadGenKeys = leadGen.dynamicMetrics.map((m) => m?.key);
    // Exactly the override's own keys — not the automatic filter's
    // meta_form_leads/cost_per_meta_form_leads pair, even though those would
    // normally be included for this campaign's own objective.
    expect(leadGenKeys).toEqual(["spend", "reach", "ctr", "link_clicks"]);
    expect(leadGenKeys).not.toContain("meta_form_leads");
    expect(leadGenKeys).not.toContain("cost_per_meta_form_leads");
  });

  it("a campaign absent from campaignMetricOverrides keeps the automatic per-objective filtering, unchanged", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides: {
        "Lead Gen": ["spend", "reach", "ctr", "link_clicks"],
      },
    });
    const websiteLeads = data.campaignSlides.find((s) => s.campaignName === "Website Leads Co")!;
    const websiteLeadsKeys = websiteLeads.dynamicMetrics.map((m) => m?.key);
    expect(websiteLeadsKeys).toContain("website_leads");
    expect(websiteLeadsKeys).toContain("cost_per_website_leads");
    expect(websiteLeadsKeys).not.toContain("meta_form_leads");
  });

  it("an ad-set slide inherits its PARENT campaign's own override, matching the same single-source-of-truth rule campaignObjectives already follows", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives,
      selectedAdSets: [adSetKey("Lead Gen", "Set 1")],
      campaignMetricOverrides: {
        "Lead Gen": ["spend", "reach", "ctr", "link_clicks"],
      },
    });
    const adSetSlide = data.adSetSlides.find((s) => s.campaignName === "Lead Gen");
    expect(adSetSlide).toBeDefined();
    const adSetKeys = adSetSlide!.dynamicMetrics.map((m) => m?.key);
    expect(adSetKeys).toEqual(["spend", "reach", "ctr", "link_clicks"]);
  });

  it("normalizes campaign name matching the same way campaignObjectives does (case/whitespace-insensitive)", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides: {
        "  lead gen  ": ["spend", "reach", "ctr", "link_clicks"],
      },
    });
    const leadGen = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    expect(leadGen.dynamicMetrics.map((m) => m?.key)).toEqual(["spend", "reach", "ctr", "link_clicks"]);
  });

  it("an empty/undefined campaignMetricOverrides leaves every campaign on the automatic per-objective filtering", () => {
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      monthlyBudget: null,
      mtdDailyRows: rows,
      now: NOW,
      selectedMetrics,
      campaignObjectives,
    });
    const leadGen = data.campaignSlides.find((s) => s.campaignName === "Lead Gen")!;
    expect(leadGen.dynamicMetrics.map((m) => m?.key)).toContain("meta_form_leads");
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

describe("buildPreviousMonthSummaryReportData — no current-period data, Previous Month Data only", () => {
  const periodRows: NreRow[] = [
    {
      _raw: {},
      campaign_name: "Campaign A",
      ad_set_name: "Set 1",
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
      campaign_name: "Campaign B",
      ad_set_name: "Set 1",
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

  function buildSummary() {
    return buildPreviousMonthSummaryReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "Asia/Kolkata",
      periodRows,
      now: NOW,
    });
  }

  it("has no campaign/ad-set slides and no chart — only the Period row's data", () => {
    const data = buildSummary();
    expect(data.isPaused).toBe(false);
    expect(data.campaignSlides).toEqual([]);
    expect(data.adSetSlides).toEqual([]);
    expect(data.chart).toBeNull();
    expect(data.pausedMessage).toBeNull();
  });

  it("the Period row has real data, summed across every Previous Month Data campaign", () => {
    const data = buildSummary();
    expect(data.periodRow.hasData).toBe(true);
    expect(data.periodRow.spend).toBe("$800"); // 500 + 300
    expect(data.periodRow.reach).toBe("3,000"); // 2000 + 1000
  });

  it("forces the MTD row to be hidden downstream — sameMonthAsCurrentMTD is always true, and the MTD row itself never has real data", () => {
    const data = buildSummary();
    expect(data.periodRow.sameMonthAsCurrentMTD).toBe(true);
    expect(data.mtdRow.hasData).toBe(false);
  });

  it("cover shows the Previous Month date range and a dedicated health badge, not a computed health score", () => {
    const data = buildSummary();
    expect(data.cover.dateRange).toBe(data.periodRow.fullMonthLabel);
    expect(data.cover.healthBadge).toContain("Previous Month Summary");
    expect(data.cover.healthScore).toBe(0);
    expect(data.cover.accountName).toBe("Test Agency");
  });

  it("tableHeaderLabels mirrors the Period row's own resultColumns", () => {
    const data = buildSummary();
    expect(data.tableHeaderLabels.resultColumns.map((c) => c.label)).toEqual(data.periodRow.resultColumns.map((c) => c.label));
  });
});
