import { describe, expect, it } from "vitest";
import { createReportEngine } from "../report-engine";
import { createPlatformReportAdapter } from "../report-engine/platform-adapter";
import { buildReportData } from "../report-data";

describe("createReportEngine", () => {
  it("delegates buildStandard to buildReportData with platform set", () => {
    const engine = createReportEngine("GOOGLE");
    const direct = buildReportData({
      accountName: "Acct",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: [],
      platform: "GOOGLE",
      reportType: "WEEKLY",
    });
    const viaEngine = engine.buildStandard({
      accountName: "Acct",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: [],
      reportType: "WEEKLY",
    });
    expect(viaEngine.platform).toBe("GOOGLE");
    expect(viaEngine.isPaused).toBe(direct.isPaused);
  });
});

describe("createPlatformReportAdapter", () => {
  it("Google adapter uses google slots", () => {
    const adapter = createPlatformReportAdapter("GOOGLE");
    expect(adapter.usesGoogleSlots).toBe(true);
    expect(adapter.usesMetaObjectives).toBe(false);
    expect(adapter.shouldEmitObjectiveWarnings([])).toBe(false);
  });

  it("Meta adapter uses meta objectives", () => {
    const adapter = createPlatformReportAdapter("META");
    expect(adapter.usesGoogleSlots).toBe(false);
    expect(adapter.usesMetaObjectives).toBe(true);
    expect(adapter.resolveGoogleContext([], {})).toBeNull();
  });

  it("TikTok shares Meta adapter behavior", () => {
    const adapter = createPlatformReportAdapter("TIKTOK");
    expect(adapter.usesGoogleSlots).toBe(false);
    expect(adapter.platform).toBe("TIKTOK");
  });
});
