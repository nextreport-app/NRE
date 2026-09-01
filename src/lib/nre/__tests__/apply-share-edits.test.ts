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

  it("applies published combined-total table rows for PPT regeneration", () => {
    const data = {
      ...minimalReportData(),
      periodRow: {
        hasData: true,
        monthLabel: "July 1 - 31",
        fullMonthLabel: "July 1 - 31",
        monthName: "July",
        sameMonthAsCurrentMTD: false,
        spend: "$582",
        reach: "1",
        impressions: "2",
        ctr: "0.1%",
        cpc: "$1",
        resultColumns: [{ label: "LEADS", costLabel: "COST PER LEAD", value: "1", cprValue: "$10" }],
      },
      mtdRow: {
        hasData: true,
        monthLabel: "August 1 - 30",
        fullMonthLabel: "August 1 - 30",
        monthName: "August",
        sameMonthAsCurrentMTD: false,
        spend: "$3,401",
        reach: "2",
        impressions: "3",
        ctr: "1%",
        cpc: "$2",
        resultColumns: [{ label: "LEADS", costLabel: "COST PER LEAD", value: "32", cprValue: "$88" }],
      },
      tableHeaderLabels: { resultColumns: [{ label: "LEADS", costLabel: "COST PER LEAD" }] },
    } as ReportData;
    const share = minimalShare({
      periodRow: data.periodRow,
      mtdRow: {
        ...data.mtdRow,
        spend: "$4,000",
        resultColumns: [{ label: "LEADS", costLabel: "COST PER LEAD", value: "40", cprValue: "$100" }],
      },
    });
    const patched = applyShareEditsToReportData(data, share);
    expect(patched.mtdRow.spend).toBe("$4,000");
    expect(patched.mtdRow.resultColumns[0]?.value).toBe("40");
  });
});
