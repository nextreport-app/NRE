import { describe, expect, it } from "vitest";
import { isWizardServerDraftExpired, parseWizardDraftSnapshot } from "../wizard-draft";

describe("wizard-server-draft", () => {
  it("parses valid draft json", () => {
    const draft = parseWizardDraftSnapshot(
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        step: 2,
        visitedSteps: [1, 2],
        uploadSessionId: "abc",
        platform: "META",
        reportType: "WEEKLY",
        dateMode: "last7",
        customStart: "",
        customEnd: "",
        selectedCampaigns: [],
        selectedAdSets: [],
        campaigns: [],
        perCampaignMetrics: [],
        campaignObjectives: [],
        previewKind: "normal",
        previewStatus: "idle",
        data: null,
        comparisonData: null,
        historicalData: null,
        dayBreakdownData: null,
        mtdRange: null,
      }),
    );
    expect(draft?.step).toBe(2);
  });

  it("expires old drafts", () => {
    const old = {
      version: 1 as const,
      savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      step: 2 as const,
      visitedSteps: [1, 2] as const,
      uploadSessionId: "abc",
      platform: "META" as const,
      reportType: "WEEKLY" as const,
      dateMode: "last7" as const,
      customStart: "",
      customEnd: "",
      selectedCampaigns: [] as string[],
      selectedAdSets: [] as string[],
      campaigns: [] as string[],
      perCampaignMetrics: [],
      campaignObjectives: [],
      previewKind: "normal" as const,
      previewStatus: "idle" as const,
      data: null,
      comparisonData: null,
      historicalData: null,
      dayBreakdownData: null,
      mtdRange: null,
    };
    expect(isWizardServerDraftExpired(old)).toBe(true);
  });
});
