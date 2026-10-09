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
      mtdRange: null,
    });
    const loaded = loadWizardDraft(clientId);
    expect(loaded?.step).toBe(3);
    expect(loaded?.uploadSessionId).toBe("sess-1");
  });
});
