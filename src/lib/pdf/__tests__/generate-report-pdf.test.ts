import { describe, expect, it } from "vitest";
import { isPdfExportAllowed } from "../generate-report-pdf";
import type { ShareReportData } from "@/lib/nre/share-report";

function minimalShare(overrides: Partial<ShareReportData> = {}): ShareReportData {
  return {
    version: 1,
    accountName: "Acme",
    platform: "META",
    reportType: "WEEKLY",
    generatedAt: new Date().toISOString(),
    cover: { dateRange: "Aug 1 - Aug 7", healthBadge: "Healthy", budgetSummary: null, healthScore: 80 },
    campaigns: [],
    adSets: [],
    chart: null,
    periodRow: { hasData: false, sameMonthAsCurrentMTD: false, cells: [] },
    mtdRow: { hasData: true, sameMonthAsCurrentMTD: false, cells: [] },
    tableHeaderLabels: [],
    metricGuide: [],
    publishedAt: null,
    ...overrides,
  } as ShareReportData;
}

describe("isPdfExportAllowed", () => {
  it("requires publishedAt", () => {
    expect(isPdfExportAllowed(minimalShare())).toBe(false);
    expect(isPdfExportAllowed(minimalShare({ publishedAt: "2026-08-31T12:00:00.000Z" }))).toBe(true);
  });
});
