import { describe, expect, it } from "vitest";
import { buildReportData } from "../report-data";
import { computeActualDataRangeInWindow } from "../date-range";
import { buildVisualChartSlideModel } from "../visual-chart-slide";
import type { NreRow } from "../columns";

function dailyRows(startDay: number, endDay: number): NreRow[] {
  return Array.from({ length: endDay - startDay + 1 }, (_, i) => ({
    _raw: { Day: `${String(startDay + i).padStart(2, "0")}-09-2026` },
    campaign_name: "LegacyLifeProductions_WebsiteLead_Campaign",
    ad_set_name: i % 2 === 0 ? "Prospecting" : "Retargeting",
    result_type: "Website Leads",
    spend: "90",
    reach: "500",
    impressions: "1000",
    website_leads: "1",
    results: "1",
    ctr: "1",
    cpc: "1",
  }));
}

describe("computeActualDataRangeInWindow", () => {
  it("floors the label start to the earliest row inside the window", () => {
    const rows = dailyRows(16, 23);
    const actual = computeActualDataRangeInWindow(rows, { startIso: "2026-08-25", endIso: "2026-09-23" });
    expect(actual).toEqual({ startIso: "2026-09-16", endIso: "2026-09-23" });
  });
});

describe("chart + MTD labels for mid-month campaign start", () => {
  const NOW = new Date("2026-09-24T12:00:00Z");

  it("uses Sep 16 - 23 on the chart title and Sep 16 - 23 on the MTD row", () => {
    const mtdDailyRows = dailyRows(16, 23);
    const data = buildReportData({
      accountName: "Legacy Life",
      currencySymbol: "C$",
      timezone: "America/Toronto",
      monthlyBudget: null,
      mtdDailyRows,
      now: NOW,
      reportType: "MONTHLY",
    });

    expect(data.chart?.periodSubLabel).toBe("Sep 16 - Sep 23, 2026");
    expect(data.chart?.actualPeriodDays).toBe(8);
    expect(data.mtdRow.monthLabel).toBe("Sep 16 - 23");

    const model = buildVisualChartSlideModel(data.chart!, "C$");
    expect(model.title).toBe("Campaign Performance: Sep 16 - Sep 23, 2026");
    expect(model.useSplitPanel).toBe(true);
    expect(model.groupedDonut).toHaveLength(1);
    expect(model.resultBars[0]!.statLine).not.toContain("% of total");
  });
});
