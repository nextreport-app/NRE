import { describe, expect, it, beforeAll } from "vitest";
import { buildReportData } from "../report-data";
import { buildShareReportData } from "../share-report";
import { slideAiKey } from "../../pptx/render";
import type { NreRow } from "../columns";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-07-20T12:00:00Z");

function daysInclusive(startDay: number, endDay: number): string[] {
  const days: string[] = [];
  for (let d = startDay; d <= endDay; d++) days.push(`${String(d).padStart(2, "0")}-07-2026`);
  return days;
}

function buildDailyRows(campaignName: string): NreRow[] {
  return daysInclusive(13, 19).map((day) => ({
    _raw: { Day: day },
    campaign_name: campaignName,
    ad_set_name: "Prospecting",
    result_type: "Purchase",
    spend: "100",
    reach: "1000",
    impressions: "3000",
    results: "2",
    link_clicks: "50",
    ctr: "1.5",
    cpc: "3",
    frequency: "3",
    date_start: day,
    date_end: day,
  }));
}

describe("buildShareReportData", () => {
  const mtdDailyRows = buildDailyRows("Shoes - Purchases");
  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: 100000,
    mtdDailyRows,
    now: NOW,
  });

  const aiCopy = new Map([[slideAiKey(data.campaignSlides[0]), { summary: "Great week.", insights: "Keep scaling." }]]);
  const share = buildShareReportData(data, aiCopy, new Date("2026-07-20T18:00:00Z"));

  it("carries version, account, report type, and generatedAt", () => {
    expect(share.version).toBe(1);
    expect(share.accountName).toBe("Test Agency");
    expect(share.reportType).toBe("WEEKLY");
    expect(share.generatedAt).toBe("2026-07-20T18:00:00.000Z");
  });

  it("mirrors the cover slide's data exactly", () => {
    expect(share.cover.dateRange).toBe(data.cover.dateRange);
    expect(share.cover.healthScore).toBe(data.cover.healthScore);
    expect(share.cover.healthBadge).toBe(data.cover.healthBadge);
    expect(share.cover.budgetSummary).toBe(data.cover.budgetSummary);
  });

  it("builds one campaign entry per campaign slide, with its own 8 dynamic metrics and matched AI copy", () => {
    expect(share.campaigns).toHaveLength(1);
    const c = share.campaigns[0];
    expect(c.campaignName).toBe("Shoes - Purchases");
    expect(c.metrics).toHaveLength(8);
    expect(c.metrics).toBe(data.campaignSlides[0].dynamicMetrics);
    expect(c.aiSummary).toBe("Great week.");
    expect(c.aiInsights).toBe("Keep scaling.");
  });

  it("falls back to empty AI copy when a slide has no matching entry in the map", () => {
    const shareNoAi = buildShareReportData(data, new Map());
    expect(shareNoAi.campaigns[0].aiSummary).toBe("");
    expect(shareNoAi.campaigns[0].aiInsights).toBe("");
  });

  it("carries the Combined Total table rows and header labels unchanged", () => {
    expect(share.periodRow).toBe(data.periodRow);
    expect(share.mtdRow).toBe(data.mtdRow);
    expect(share.tableHeaderLabels).toBe(data.tableHeaderLabels);
  });

  it("only includes campaign slides, never ad-set slides", () => {
    // Two ad sets under the same campaign would otherwise produce ad-set
    // slides too — confirm the share payload doesn't leak them in.
    const multiAdSetRows = [...buildDailyRows("Shoes - Purchases"), ...buildDailyRows("Shoes - Purchases")];
    const multiData = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: multiAdSetRows,
      now: NOW,
    });
    const multiShare = buildShareReportData(multiData, new Map());
    expect(multiShare.campaigns).toHaveLength(multiData.campaignSlides.length);
  });
});
