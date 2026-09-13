import { describe, expect, it, beforeAll } from "vitest";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";
import { buildReportData } from "../report-data";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-07-20T12:00:00Z");

function googleCsv(dataRows: string[][]): ReturnType<typeof parseMtdCsvForAdPlatform>["rows"] {
  const header = "Campaign,Ad group,Day,Cost,Clicks,Impr.,CTR,Avg. CPC,Conversions";
  const days = ["13", "14", "15", "16", "17", "18", "19"].map((d) => `${d}-07-2026`);
  const lines = [header];
  for (const row of dataRows) {
    for (const day of days) {
      lines.push([row[0], row[1], day, ...row.slice(2)].join(","));
    }
  }
  return parseMtdCsvForAdPlatform(Buffer.from(lines.join("\n"), "utf8"), "GOOGLE").rows;
}

function buildGoogle(dataRows: string[][], extra: Partial<Parameters<typeof buildReportData>[0]> = {}) {
  return buildReportData({
    accountName: "Test Agency",
    currencySymbol: "$",
    timezone: "UTC",
    monthlyBudget: null,
    mtdDailyRows: googleCsv(dataRows),
    platform: "GOOGLE",
    now: NOW,
    ...extra,
  });
}

describe("buildReportData — Google platform (unified pipeline)", () => {
  it("uses Search campaign-type labels and resolves slot metrics from normalized headers", () => {
    const data = buildGoogle([["Shoes - Search", "Prospecting", "50", "20", "1000", "2%", "2.50", "3"]]);
    expect(data.platform).toBe("GOOGLE");
    expect(data.campaignSlides).toHaveLength(1);
    const slide = data.campaignSlides[0];
    expect(slide.resultLabel).toBe("CONVERSIONS");
    expect(slide.costLabel).toBe("COST PER CONVERSION");
    expect(slide.metrics.spend).toBe("$350");
    expect(slide.dynamicMetrics.some((m) => m?.key === "conversions")).toBe(true);
    const spendSlot = slide.dynamicMetrics.find((m) => m?.key === "cost" || m?.key === "spend");
    expect(spendSlot?.value).not.toBe("—");
    expect(data.objectiveWarnings).toEqual([]);
  });

  it("aggregates one campaign slide per distinct campaign", () => {
    const data = buildGoogle([
      ["Shoes - Search", "Prospecting", "50", "20", "1000", "2%", "2.50", "3"],
      ["Brand - Display", "Awareness", "30", "10", "2000", "0.5%", "3.00", "0"],
    ]);
    expect(data.campaignSlides).toHaveLength(2);
    const totalSpend = data.campaignSlides.reduce((sum, s) => sum + parseFloat(s.metrics.spend.replace(/[$,]/g, "")), 0);
    expect(totalSpend).toBe(560);
  });

  it("produces one ad-group slide per distinct (campaign, ad group) pair", () => {
    const data = buildGoogle([
      ["Shoes - Search", "Prospecting", "50", "20", "1000", "2%", "2.50", "3"],
      ["Shoes - Search", "Retargeting", "40", "15", "800", "1.8%", "2.60", "2"],
    ]);
    expect(data.adSetSlides.length).toBeGreaterThanOrEqual(2);
    const names = data.adSetSlides.map((s) => s.adSetName).sort();
    expect(names).toEqual(["Prospecting", "Retargeting"]);
  });

  it("uses Display campaign-type slide labels when viewable impr. column is present", () => {
    const header =
      "Campaign,Ad group,Day,Cost,Clicks,Impr.,CTR,Avg. CPC,Conversions,Viewable impr.,Viewable rate";
    const days = ["13", "14", "15", "16", "17", "18", "19"];
    const lines = [
      header,
      ...days.map((d) => `Brand - Display,Awareness,${d}-07-2026,30,10,2000,0.5%,3.00,0,1500,75%`),
    ];
    const { rows } = parseMtdCsvForAdPlatform(Buffer.from(lines.join("\n"), "utf8"), "GOOGLE");
    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: rows,
      platform: "GOOGLE",
      now: NOW,
    });
    const slide = data.campaignSlides.find((s) => s.campaignName === "Brand - Display")!;
    expect(slide.resultLabel).toBe("VIEWABLE IMPR.");
    expect(slide.costLabel).toBe("VIEWABLE RATE");
  });

  it("populates dynamicMetrics with 8 entries for Search CSV", () => {
    const data = buildGoogle([["Shoes - Search", "Prospecting", "50", "20", "1000", "2%", "2.50", "3"]]);
    expect(data.campaignSlides[0].dynamicMetrics).toHaveLength(8);
  });
});
