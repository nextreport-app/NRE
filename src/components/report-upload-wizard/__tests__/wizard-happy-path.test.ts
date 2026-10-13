import { describe, expect, it } from "vitest";
import {
  evaluateHappyPathEligibility,
  fingerprintCsvHeaders,
  type WizardGenerateBaseline,
} from "../wizard-happy-path";

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
  campaignNames: ["A", "B"],
  selectedCampaigns: ["A"],
  selectedAdSets: [],
  perCampaignMetrics: [],
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

  it("blocks API sync uploads", () => {
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
      isApiSyncArtifact: true,
      apiSyncHybridImport: false,
      csvHeaders: ["Campaign name", "Spend"],
      campaignNames: ["A", "B"],
      validCampaigns: new Set(["A", "B"]),
      validAdSetKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, reason: "not_manual_csv" });
  });
});
