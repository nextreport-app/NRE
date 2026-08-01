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
