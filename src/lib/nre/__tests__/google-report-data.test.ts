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

describe("buildGoogleReportData — automatic 8-slot metric assignment (Change 2, no wizard input)", () => {
  const mtdDailyRows = rows(
    ["Shoes - Search", "Prospecting", "13-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
    ["Shoes - Search", "Prospecting", "14-07-2026", "50", "20", "1000", "2%", "2.50", "3"],
  );

  it("always populates dynamicMetrics with exactly 8 entries, with no selectedMetrics input at all", () => {
    const data = buildGoogleReportData({ accountName: "Test Agency", currencySymbol: "$", monthlyBudget: null, mtdDailyRows });
    const dynamicMetrics = data.campaignSlides[0].dynamicMetrics;
    expect(dynamicMetrics).toHaveLength(8);
    expect(dynamicMetrics.map((m) => m.key)).toEqual([
      "spend",
      "reach",
      "impressions",
      "conversions",
      "cost_per_conv",
      "ctr",
      "avg_cpc",
      "conv_rate",
    ]);
  });

  it("defaults slots 4-5 to CONVERSIONS + COST PER CONV. (Search pattern) for a plain Search Ads CSV", () => {
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: rows(["Shoes - Search", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4"]),
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3].label).toBe("CONVERSIONS");
    expect(slots[3].value).toBe("4");
    expect(slots[4].label).toBe("COST PER CONV.");
    expect(slots[4].value).toBe("$25.00"); // 100 / 4
  });

  it("keeps slots 1-3 and 6-7 fixed (Spend/Reach/Impressions/CTR/CPC) regardless of objective", () => {
    const data = buildGoogleReportData({ accountName: "Test Agency", currencySymbol: "$", monthlyBudget: null, mtdDailyRows });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[0]).toMatchObject({ key: "spend", label: "AD SPEND" });
    expect(slots[1]).toMatchObject({ key: "reach", label: "REACH" });
    expect(slots[2]).toMatchObject({ key: "impressions", label: "IMPRESSIONS" });
    expect(slots[5]).toMatchObject({ key: "ctr", label: "CTR (ALL)" });
    expect(slots[6]).toMatchObject({ key: "avg_cpc", label: "CPC (ALL)" });
  });

  it("switches slots 4-5 to CONV. VALUE + ROAS for a Shopping/Performance Max CSV", () => {
    const shoppingHeaders = ["Campaign", "Ad group", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC", "Conversions", "Orders"];
    const shoppingRows = readGoogleRowsWithAutoMap(shoppingHeaders, [
      ["Shoes - Shopping", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4", "3"],
    ]).rows;
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: shoppingRows,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3].label).toBe("CONV. VALUE");
    expect(slots[4].label).toBe("ROAS");
  });

  it("switches slots 4-5 to VIEWABLE IMPR. + VIEWABLE RATE for a Display CSV", () => {
    const displayHeaders = ["Campaign", "Ad group", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC", "Conversions", "Viewable impr.", "Viewable rate"];
    const displayRows = readGoogleRowsWithAutoMap(displayHeaders, [
      ["Shoes - Display", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4", "800", "80%"],
    ]).rows;
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: displayRows,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3].label).toBe("VIEWABLE IMPR.");
    expect(slots[4].label).toBe("VIEWABLE RATE");
  });

  it("switches slots 4-5 to VIDEO VIEWS + AVG. CPV for a Video/TrueView CSV", () => {
    const videoHeaders = ["Campaign", "Ad group", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC", "Conversions", "TrueView views", "TrueView avg. CPV"];
    const videoRows = readGoogleRowsWithAutoMap(videoHeaders, [
      ["Shoes - Video", "Prospecting", "13-07-2026", "100", "20", "1000", "2%", "5.00", "4", "500", "0.20"],
    ]).rows;
    const data = buildGoogleReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      monthlyBudget: null,
      mtdDailyRows: videoRows,
    });
    const slots = data.campaignSlides[0].dynamicMetrics;
    expect(slots[3].label).toBe("VIDEO VIEWS");
    expect(slots[4].label).toBe("AVG. CPV");
  });

  it("never splits a campaign into a second/continued slide — a campaign always gets exactly one slide with the automatic 8-slot assignment", () => {
    const data = buildGoogleReportData({ accountName: "Test Agency", currencySymbol: "$", monthlyBudget: null, mtdDailyRows });
    const slidesForShoes = data.campaignSlides.filter((s) => s.campaignName.startsWith("Shoes"));
    expect(slidesForShoes.length).toBe(1);
    expect(slidesForShoes[0].campaignName).toBe("Shoes - Search");
    expect(slidesForShoes[0].dynamicMetrics.length).toBe(8);
  });
});
