import { describe, expect, it } from "vitest";
import {
  computeMetricsFingerprint,
  evaluateHappyPathEligibility,
  fingerprintCsvHeaders,
  metricsMatchBaseline,
  type WizardGenerateBaseline,
} from "../wizard-generate-baseline";

const baseline: WizardGenerateBaseline = {
  version: 1,
  savedAt: "2026-01-01T00:00:00.000Z",
  platform: "META",
  reportType: "WEEKLY",
  dateMode: "last7",
  includePreviousMonthComparison: false,
  showBudgetOnCover: true,
  dataSourceMode: "csv",
  csvHeaderFingerprint: fingerprintCsvHeaders(["Spend", "Campaign name"]),
  metricsFingerprint: "acme:spend,reach",
  campaignNames: ["A", "B"],
  selectedCampaigns: ["A"],
  selectedAdSets: [],
  perCampaignMetrics: [{ normalized: "acme", metrics: [] }],
  campaignObjectives: [],
  touchedObjectiveCampaigns: [],
};

describe("evaluateHappyPathEligibility", () => {
  it("allows when baseline matches upload and settings", () => {
    const result = evaluateHappyPathEligibility({
      baseline,
      platform: "META",
      reportType: "WEEKLY",
      dateMode: "last7",
      customStart: "",
      customEnd: "",
      includePreviousMonthComparison: false,
      showBudgetOnCover: true,
      dataSourceMode: "csv",
      isApiSyncArtifact: false,
      apiSyncHybridImport: false,
      csvHeaders: ["Campaign name", "Spend"],
      campaignNames: ["B", "A"],
      validCampaigns: new Set(["A", "B"]),
      validAdSetKeys: new Set(),
    });
    expect(result.ok).toBe(true);
  });

  it("blocks when CSV headers change", () => {
    const result = evaluateHappyPathEligibility({
      baseline,
      platform: "META",
      reportType: "WEEKLY",
      dateMode: "last7",
      customStart: "",
      customEnd: "",
      includePreviousMonthComparison: false,
      showBudgetOnCover: true,
      dataSourceMode: "csv",
      isApiSyncArtifact: false,
      apiSyncHybridImport: false,
      csvHeaders: ["Campaign name", "Spend", "Results"],
      campaignNames: ["A", "B"],
      validCampaigns: new Set(["A", "B"]),
      validAdSetKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, reason: "csv_headers_changed" });
  });
});

describe("metricsMatchBaseline", () => {
  it("compares metricsFingerprint when present", () => {
    const fp = computeMetricsFingerprint(["Acme"], {
      acme: [
        { key: "spend", label: "Spend", format: "currency", csvName: "Spend" },
        { key: "reach", label: "Reach", format: "number", csvName: "Reach" },
      ],
    });
    expect(fp).toBe("acme:reach,spend");
    const metrics = {
      acme: [
        { key: "spend", label: "Spend", format: "currency" as const, csvName: "Spend" },
        { key: "reach", label: "Reach", format: "number" as const, csvName: "Reach" },
      ],
    };
    expect(metricsMatchBaseline({ ...baseline, metricsFingerprint: fp }, ["Acme"], metrics)).toBe(true);
  });
});
