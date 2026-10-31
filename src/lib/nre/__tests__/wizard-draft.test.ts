import { describe, expect, it, beforeEach, vi } from "vitest";
import { clearWizardDraft, loadWizardDraft, saveWizardDraft } from "../wizard-draft";

describe("wizard-draft", () => {
  const clientId = "client_test";
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    clearWizardDraft(clientId);
  });

  it("round-trips draft in sessionStorage", () => {
    saveWizardDraft(clientId, {
      version: 1,
      savedAt: new Date().toISOString(),
      step: 3,
      visitedSteps: [1, 2, 3],
      uploadSessionId: "sess-1",
      platform: "META",
      reportType: "WEEKLY",
      dateMode: "last7",
      customStart: "",
      customEnd: "",
      selectedCampaigns: ["A"],
      selectedAdSets: [],
      campaigns: ["A"],
      perCampaignMetrics: [],
      campaignObjectives: [],
      previewKind: "normal",
      previewStatus: "idle",
      data: null,
      comparisonData: null,
      historicalData: null,
      dayBreakdownData: null,
      mtdRange: { startIso: "2026-10-01", endIso: "2026-10-13" },
      weeklyOptions: {
        last7: { startIso: "2026-10-07", endIso: "2026-10-13" },
        prev7: { startIso: "2026-09-30", endIso: "2026-10-06" },
        last14: { startIso: "2026-09-30", endIso: "2026-10-13" },
      },
      dateBounds: { minIso: "2026-09-01", maxIso: "2026-10-13" },
    });
    const loaded = loadWizardDraft(clientId);
    expect(loaded?.step).toBe(3);
    expect(loaded?.uploadSessionId).toBe("sess-1");
    expect(loaded?.weeklyOptions?.last7.endIso).toBe("2026-10-13");
    saveWizardDraft(clientId, { ...loaded!, reportType: "HISTORICAL", historicalMonthCount: 6, dateMode: "custom", customStart: "2026-04-01", customEnd: "2026-09-30" });
    expect(loadWizardDraft(clientId)).toMatchObject({ reportType: "HISTORICAL", historicalMonthCount: 6, customStart: "2026-04-01", customEnd: "2026-09-30" });
    const comparison = { comparisonMetricKeys: ["impressions", "cpc_all"], csvHeaders: ["Impressions", "CPC (all)"], reportType: "COMPARISON" as const, comparisonPreset: "custom" as const, comparisonPeriodA: { startIso: "2026-09-01", endIso: "2026-09-30" }, comparisonPeriodB: { startIso: "2025-09-01", endIso: "2025-09-30" } };
    saveWizardDraft(clientId, { ...loaded!, ...comparison });
    expect(loadWizardDraft(clientId)).toMatchObject(comparison);
  });
});
