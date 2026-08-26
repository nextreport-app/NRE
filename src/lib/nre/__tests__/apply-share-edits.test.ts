import { describe, expect, it } from "vitest";
import { applyShareEditsToReportData } from "../apply-share-edits";
import type { ReportData } from "../report-data";
import type { ShareReportData } from "../share-report";

function minimalReportData(): ReportData {
  return {
    reportType: "WEEKLY",
    platform: "META",
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
});
