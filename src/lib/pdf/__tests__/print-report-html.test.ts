import { describe, expect, it } from "vitest";
import { buildPrintReportHtml, buildPrintChartSlideHtml } from "../print-report-html";
import type { ShareReportData, ShareChartData } from "@/lib/nre/share-report";

function minimalShare(): ShareReportData {
  return {
    version: 1,
    accountName: "Acme Co",
    platform: "META",
    reportType: "WEEKLY",
    generatedAt: "2026-08-31T12:00:00.000Z",
    publishedAt: "2026-08-31T12:00:00.000Z",
    cover: { dateRange: "Aug 1 - Aug 7", healthBadge: "Healthy", budgetSummary: null, healthScore: 80 },
    campaigns: [],
    adSets: [],
    chart: null,
    periodRow: { hasData: false, sameMonthAsCurrentMTD: false, cells: [] },
    mtdRow: { hasData: false, sameMonthAsCurrentMTD: false, cells: [] },
    tableHeaderLabels: ["Metric", "Period", "MTD"],
    metricGuide: [],
    visibility: {
      cover: true,
      overview: false,
      combinedTotal: false,
      metricGuide: false,
      campaigns: {},
      adSets: {},
    },
  } as ShareReportData;
}

describe("buildPrintChartSlideHtml", () => {
  it("renders chart-slide-capture with ShareMtdOverviewSlide markup", () => {
    const chart: ShareChartData = {
      title: "August · Month to date overview: August 1 - August 30, 2026",
      subtitle: "Month to date performance · Where your budget went",
      totalSpendLabel: "$3,401",
      donutSegments: [
        { name: "InstantForms", spend: 2824, percentage: 83.1, color: "f6ad55", spendLabel: "$2,824" },
      ],
      snapshot: {
        mtdSpendFormatted: "$3,401",
        mode: "multi",
        primaryResultsValue: "32",
        primaryResultsLabel: "META FORM LEADS",
        primaryCprValue: "$88.26",
        primaryCprLabel: "COST PER META FORM LEAD",
        primarySpendFormatted: "$2,824",
        budgetPctUsed: "340%",
        activeCampaignCount: 2,
        objectives: [],
        objectivesOmittedCount: 0,
      },
      activeCampaignCount: 2,
      totalAllSpend: 3401,
    };
    const html = buildPrintChartSlideHtml(chart);
    expect(html).toContain('id="chart-slide-capture"');
    expect(html).toContain("August · Month to date overview");
    expect(html).toContain("Campaign spend mix");
    expect(html).toContain("TOTAL SPEND");
  });
});
