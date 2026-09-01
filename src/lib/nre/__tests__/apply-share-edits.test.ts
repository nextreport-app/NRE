import { describe, expect, it } from "vitest";
import { applyShareEditsToReportData } from "../apply-share-edits";
import type { ReportData } from "../report-data";
import type { ShareReportData } from "../share-report";

function minimalReportData(): ReportData {
  return {
    reportType: "WEEKLY",
    platform: "META",
    cover: {
      accountName: "Test Co",
      reportDate: "01-01-2026",
      dateRange: "Jan 1 - Jan 7",
      healthBadge: "On Track",
      healthScore: 80,
      budgetSummary: "",
    },
    periodRow: { hasData: false, sameMonthAsCurrentMTD: false, cells: [] },
    mtdRow: { hasData: true, sameMonthAsCurrentMTD: false, cells: [] },
    tableHeaderLabels: [],
    campaignSlides: [
      {
        campaignName: "Brand",
        dynamicMetrics: [
          { key: "ctr", label: "CTR", format: "percent", value: "5.49%" },
          { key: "spend", label: "Spend", format: "currency", value: "$100" },
          null,
          null,
        ],
        additionalMetricsSlide: null,
      },
    ],
    adSetSlides: [],
    chart: null,
    combinedTotalStory: null,
    metricGuide: [],
    isPaused: false,
  } as unknown as ReportData;
}

function minimalShare(overrides: Partial<ShareReportData> = {}): ShareReportData {
  return {
    version: 1,
    platform: "META",
    reportType: "WEEKLY",
    campaigns: [
      {
        campaignName: "Brand",
        aiSummary: "Summary",
        aiInsights: "Insights",
        metrics: [
          { key: "ctr", label: "CTR", format: "percent", value: "5.50%" },
          { key: "spend", label: "Spend", format: "currency", value: "$100" },
        ],
      },
    ],
    adSets: [],
    cover: {
      reportDate: "01-01-2026",
      dateRange: "Jan 1 - Jan 7",
      healthBadge: "On Track",
      healthScore: 80,
      budgetSummary: "",
    },
    ...overrides,
  } as ShareReportData;
}

describe("applyShareEditsToReportData", () => {
  it("patches campaign dynamic metric values from published share edits", () => {
    const data = minimalReportData();
    const share = minimalShare();
    const patched = applyShareEditsToReportData(data, share);
    expect(patched.campaignSlides[0]?.dynamicMetrics?.[0]?.value).toBe("5.50%");
    expect(patched.campaignSlides[0]?.dynamicMetrics?.[1]?.value).toBe("$100");
  });

  it("leaves slides alone when campaign is not in share", () => {
    const data = minimalReportData();
    const share = minimalShare({ campaigns: [] });
    const patched = applyShareEditsToReportData(data, share);
    expect(patched.campaignSlides[0]?.dynamicMetrics?.[0]?.value).toBe("5.49%");
  });

  it("patches cover fields from published share edits", () => {
    const data = {
      ...minimalReportData(),
      cover: {
        accountName: "Original Co",
        reportDate: "01-01-2026",
        dateRange: "Jan 1 - Jan 7",
        healthBadge: "On Track",
        healthScore: 80,
        budgetSummary: "",
      },
    } as ReportData;
    const share = minimalShare({
      accountName: "Edited Co",
      cover: {
        reportDate: "01-01-2026",
        dateRange: "Jan 1 - Jan 31",
        healthBadge: "Needs Attention",
        healthScore: 55,
        budgetSummary: "",
      },
    });
    const patched = applyShareEditsToReportData(data, share);
    expect(patched.cover.accountName).toBe("Edited Co");
    expect(patched.cover.dateRange).toBe("Jan 1 - Jan 31");
    expect(patched.cover.healthBadge).toBe("Needs Attention");
    expect(patched.cover.budgetSummary).toBe("");
  });
});
