import { describe, expect, it } from "vitest";
import { computeHistoricalMonthRanges, validateHistoricalCsvCoverage } from "../date-range";
import { buildHistoricalReportData, validateHistoricalReportInput } from "../historical-report-data";
import type { NreRow } from "../columns";

function dailyRow(iso: string, campaign: string, spend: string): NreRow {
  return {
    campaign_name: campaign,
    ad_set_name: "Set 1",
    spend,
    reach: "100",
    impressions: "1000",
    results: "5",
    ctr: "1",
    cpc: "0.5",
    date_start: iso,
    date_end: iso,
    _raw: { Day: iso, Spend: spend },
  };
}

describe("computeHistoricalMonthRanges", () => {
  it("returns four complete prior months on Sep 7 2026", () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const ranges = computeHistoricalMonthRanges(4, now, "UTC");
    expect(ranges.map((r) => r.fullMonthLabel)).toEqual([
      "May 2026",
      "June 2026",
      "July 2026",
      "August 2026",
    ]);
    expect(ranges[0].performanceHeader).toBe("YOUR MAY PERFORMANCE REPORT");
  });
});

describe("buildHistoricalReportData", () => {
  it("builds one slide per campaign per month with month headers", () => {
    const fullRows: NreRow[] = [];
    for (const month of [5, 6, 7, 8]) {
      fullRows.push(dailyRow(`2026-${String(month).padStart(2, "0")}-01`, "Shoes", "10"));
      fullRows.push(dailyRow(`2026-${String(month).padStart(2, "0")}-15`, "Shoes", "10"));
      fullRows.push(dailyRow(`2026-${String(month).padStart(2, "0")}-28`, "Shoes", "10"));
    }

    const now = new Date("2026-09-07T12:00:00Z");
    const ok = validateHistoricalReportInput(fullRows, 4, now, "UTC");
    expect(ok.valid).toBe(true);

    const data = buildHistoricalReportData({
      accountName: "Acme",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: fullRows,
      monthCount: 4,
      now,
    });

    expect(data.isPaused).toBe(false);
    expect(data.slides).toHaveLength(4);
    expect(data.slides[0].performanceHeader).toBe("YOUR MAY PERFORMANCE REPORT");
    expect(data.slides[3].performanceHeader).toBe("YOUR AUGUST PERFORMANCE REPORT");
    expect(data.slides.every((s) => s.campaignName === "Shoes")).toBe(true);
  });
});

describe("validateHistoricalCsvCoverage", () => {
  it("flags months with no overlap in CSV bounds", () => {
    const bounds = { minIso: "2026-06-01", maxIso: "2026-08-31" };
    const ranges = computeHistoricalMonthRanges(4, new Date("2026-09-07T12:00:00Z"), "UTC");
    const result = validateHistoricalCsvCoverage(bounds, ranges);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("May 2026");
  });
});
