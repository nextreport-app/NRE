import { describe, expect, it } from "vitest";
import { buildPrintReportHtml } from "../print-report-html";
import type { ShareReportData } from "@/lib/nre/share-report";

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

describe("buildPrintReportHtml", () => {
  it("renders share-report-print markup with embedded styles", () => {
    const html = buildPrintReportHtml(minimalShare());
    expect(html).toContain('id="share-report-print"');
    expect(html).toContain("Acme Co");
    expect(html).toContain(".print-slide");
    expect(html).toContain("fonts.googleapis.com");
  });
});
