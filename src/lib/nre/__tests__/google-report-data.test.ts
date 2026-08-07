import { describe, expect, it } from "vitest";
import { readGoogleRowsWithAutoMap } from "../google-columns";
import { buildGoogleReportData } from "../google-report-data";

const HEADERS = ["Campaign", "Ad group", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC", "Conversions"];

function rows(...rowsData: string[][]) {
  return readGoogleRowsWithAutoMap(HEADERS, rowsData).rows;
}

describe("buildGoogleReportData", () => {
  it("aggregates one campaign slide per distinct campaign, summing cost/clicks/impressions/conversions", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(
        ["Shoes - Search", "Prospecting", "13-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
        ["Shoes - Search", "Prospecting", "14-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
        ["Brand - Display", "Awareness", "13-07-2026", "30", "10", "2000", "0.5%", "3.00", "0"],
      ),
    });

    expect(data.platform).toBe("GOOGLE");
    expect(data.campaignSlides).toHaveLength(2);
    const shoes = data.campaignSlides.find((s) => s.campaignName === "Shoes - Search")!;
    expect(shoes.metrics.spend).toBe("$100");
    expect(shoes.metrics.reach).toBe("40"); // clicks, repurposing the "reach" slot
    expect(shoes.metrics.impressions).toBe("2,000");
    expect(shoes.metrics.results).toBe("6"); // conversions
    expect(shoes.resultLabel).toBe("CONVERSIONS");
    expect(shoes.costLabel).toBe("COST PER CONVERSION");
  });

  it("produces one ad-group slide per distinct (campaign, ad group) pair", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(
        ["Shoes - Search", "Prospecting", "13-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
        ["Shoes - Search", "Retargeting", "13-07-2026", "40", "15", "800", "1.8%", "2.60", "2"],
      ),
    });

    expect(data.adSetSlides).toHaveLength(2);
    const names = data.adSetSlides.map((s) => s.adSetName).sort();
    expect(names).toEqual(["Prospecting", "Retargeting"]);
    expect(data.adSetSlides[0].kind).toBe("adset");
  });

  it("derives cost-per-conversion from summed cost/conversions rather than requiring the optional CSV column", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(["Shoes - Search", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4"]),
    });
    const shoes = data.campaignSlides[0];
    expect(shoes.metrics.cpr).toBe("$25.00"); // 100 / 4
  });

  it("marks the report paused (isPaused, null chart) when total cost is zero", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(["Shoes - Search", "Prospecting", "13-07-2026", "0", "0", "0", "0%", "0", "0"]),
    });
    expect(data.isPaused).toBe(true);
    expect(data.chart).toBeNull();
  });

  it("builds a chart slide with one entry per campaign when active", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(
        ["Shoes - Search", "Prospecting", "13-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
        ["Brand - Display", "Awareness", "13-07-2026", "30", "10", "2000", "0.5%", "3.00", "0"],
      ),
    });
    expect(data.chart).not.toBeNull();
    expect(data.chart!.campaigns).toHaveLength(2);
    expect(data.chart!.reportType).toBe("WEEKLY");
  });

  it("hides the Period row (no Previous Month Data support for Google in this pass) and shows only the MTD row's totals", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(["Shoes - Search", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4"]),
    });
    expect(data.periodRow.hasData).toBe(false);
    expect(data.mtdRow.hasData).toBe(true);
    expect(data.mtdRow.spend).toBe("$100");
    expect(data.mtdRow.resultColumns[0].label).toBe("CONVERSIONS");
    expect(data.mtdRow.resultColumns[0].value).toBe("4");
  });

  it("skips rows with an empty campaign name entirely", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(
        ["", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4"],
        ["Shoes - Search", "Prospecting", "13-07-2026", "50", "10", "500", "2%", "5.00", "2"],
      ),
    });
    expect(data.campaignSlides).toHaveLength(1);
    expect(data.campaignSlides[0].metrics.spend).toBe("$50");
  });
});

describe("buildGoogleReportData — dynamic metric dictionary system (selectedMetrics)", () => {
  const mtdDailyRows = rows(
    ["Shoes - Search", "Prospecting", "13-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
    ["Shoes - Search", "Prospecting", "14-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
  );

  it("leaves dynamicMetrics undefined when selectedMetrics is omitted", () => {
    const data = buildGoogleReportData({ accountName: "Test Agency", currencySymbol: "$", monthlyBudget: null, mtdDailyRows });
    expect(data.campaignSlides[0].dynamicMetrics).toBeUndefined();
  });

  it("populates dynamicMetrics from the Google dictionary's own csvNames, summed across rows", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows,
      selectedMetrics: [
        { key: "cost", label: "COST", format: "currency", type: "primary", priority: 100, csvName: "cost" },
        { key: "clicks", label: "CLICKS", format: "number", type: "primary", priority: 90, csvName: "clicks" },
      ],
    });
    const dynamicMetrics = data.campaignSlides[0].dynamicMetrics;
    expect(dynamicMetrics).toBeDefined();
    expect(dynamicMetrics!.map((m) => m.key)).toEqual(["cost", "clicks"]);
    expect(dynamicMetrics![0].value).toBe("$100.00");
    expect(dynamicMetrics![1].value).toBe("40");
  });

  it("computes avg_cpc as sum(cost)/sum(clicks) instead of summing the raw column (Fix 3)", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows,
      selectedMetrics: [
        { key: "avg_cpc", label: "AVG. CPC", format: "currency", type: "primary", priority: 80, csvName: "avg. cpc", perUnitOf: "clicks" },
      ],
    });
    // sum(cost)=100, sum(clicks)=40 -> 2.50 — NOT the raw column's own
    // per-row 2.50+2.50 summed to 5.00.
    expect(data.campaignSlides[0].dynamicMetrics![0].value).toBe("$2.50");
  });

  it("never splits a campaign into a second/continued slide, even with more than 12 selectedMetrics — caps at the top 12 by priority instead (Fix 3)", () => {
    const thirteenMetrics = [
      { key: "cost", label: "COST", format: "currency" as const, type: "primary" as const, priority: 100, csvName: "cost" },
      { key: "impressions", label: "IMPRESSIONS", format: "number" as const, type: "primary" as const, priority: 95, csvName: "impr." },
      { key: "clicks", label: "CLICKS", format: "number" as const, type: "primary" as const, priority: 90, csvName: "clicks" },
      { key: "ctr", label: "CTR", format: "percentage" as const, type: "primary" as const, priority: 85, csvName: "ctr" },
      { key: "avg_cpc", label: "AVG. CPC", format: "currency" as const, type: "primary" as const, priority: 80, csvName: "avg. cpc", perUnitOf: "clicks" },
      { key: "conversions", label: "CONVERSIONS", format: "number" as const, type: "primary" as const, priority: 75, csvName: "conversions" },
      { key: "cost_per_conv", label: "COST PER CONV.", format: "currency" as const, type: "secondary" as const, priority: 74, csvName: "cost / conv.", perUnitOf: "conversions" },
      { key: "conv_rate", label: "CONV. RATE", format: "percentage" as const, type: "secondary" as const, priority: 73, csvName: "conv. rate" },
      { key: "search_impr_share", label: "SEARCH IMPR. SHARE", format: "percentage" as const, type: "secondary" as const, priority: 72, csvName: "search impr. share" },
      { key: "quality_score", label: "QUALITY SCORE", format: "number" as const, type: "secondary" as const, priority: 71, csvName: "quality score" },
      { key: "all_conv", label: "ALL CONV.", format: "number" as const, type: "secondary" as const, priority: 70, csvName: "all conv." },
      { key: "view_through_conv", label: "VIEW-THROUGH CONV.", format: "number" as const, type: "secondary" as const, priority: 65, csvName: "view-through conv." },
      { key: "target_cpa", label: "TARGET CPA", format: "currency" as const, type: "secondary" as const, priority: 60, csvName: "avg. target cpa", perUnitOf: "__avg__" },
    ];
    expect(thirteenMetrics.length).toBe(13);
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows,
      selectedMetrics: thirteenMetrics,
    });
    const slidesForShoes = data.campaignSlides.filter((s) => s.campaignName.startsWith("Shoes"));
    expect(slidesForShoes.length).toBe(1);
    expect(slidesForShoes[0].campaignName).toBe("Shoes - Search");
    expect(slidesForShoes[0].dynamicMetrics!.length).toBe(12);
    const keys = slidesForShoes[0].dynamicMetrics!.map((m) => m.key);
    expect(keys).not.toContain("target_cpa"); // lowest-priority, 13th metric — dropped, not put on a second slide
  });
});
