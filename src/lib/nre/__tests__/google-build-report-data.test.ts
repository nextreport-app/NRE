import { describe, expect, it, beforeAll } from "vitest";
import { parseMtdCsvForAdPlatform } from "../tiktok-columns";
import { buildReportData } from "../report-data";

beforeAll(() => {
  process.env.TZ = "UTC";
});

describe("buildReportData — Google platform", () => {
  it("uses Google slot labels and CONVERSIONS objective through the unified pipeline", () => {
    const csv = [
      "Campaign,Ad group,Day,Cost,Clicks,Impr.,CTR,Avg. CPC,Conversions",
      "Shoes - Search,Prospecting,13-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,14-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,15-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,16-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,17-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,18-07-2026,50,20,1000,2%,2.50,3",
      "Shoes - Search,Prospecting,19-07-2026,50,20,1000,2%,2.50,3",
    ].join("\n");
    const { rows } = parseMtdCsvForAdPlatform(Buffer.from(csv, "utf8"), "GOOGLE");

    const data = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: rows,
      platform: "GOOGLE",
      now: new Date("2026-07-20T12:00:00Z"),
    });

    expect(data.platform).toBe("GOOGLE");
    expect(data.campaignSlides).toHaveLength(1);
    const slide = data.campaignSlides[0];
    expect(slide.resultLabel).toBe("CONVERSIONS");
    expect(slide.costLabel).toBe("COST PER CONVERSION");
    expect(slide.metrics.spend).toBe("$350");
    expect(slide.dynamicMetrics.some((m) => m?.key === "conversions")).toBe(true);
    expect(data.objectiveWarnings).toEqual([]);
  });
});
