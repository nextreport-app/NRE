import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coerceLaunchPlatform,
  coerceLaunchReportType,
  isClientPlatformConnectionVisible,
  isLaunchPlatformEnabled,
  isLaunchReportTypeEnabled,
  isWizardPlatformSwitchEnabled,
  LAUNCH_ENABLED_PLATFORMS,
  LAUNCH_ENABLED_REPORT_TYPES,
} from "../meta-launch-scope";

describe("meta launch scope", () => {
  afterEach(() => {
    delete process.env.GOOGLE_OAUTH_VERIFICATION_UI;
  });
  it("enables Meta only", () => {
    expect(LAUNCH_ENABLED_PLATFORMS).toEqual(["META"]);
    expect(isLaunchPlatformEnabled("META")).toBe(true);
    expect(isLaunchPlatformEnabled("GOOGLE")).toBe(false);
  });

  it("coerces deferred platforms to Meta", () => {
    expect(coerceLaunchPlatform("GOOGLE")).toBe("META");
    expect(coerceLaunchPlatform("TIKTOK")).toBe("META");
    expect(coerceLaunchPlatform("GA4")).toBe("META");
  });

  it("unlocks Google Ads and GA4 for OAuth verification when env is set", async () => {
    process.env.GOOGLE_OAUTH_VERIFICATION_UI = "true";
    vi.resetModules();
    const scope = await import("../meta-launch-scope");
    expect(scope.isLaunchPlatformEnabled("GOOGLE")).toBe(true);
    expect(scope.isLaunchPlatformEnabled("GA4")).toBe(true);
    expect(scope.isLaunchPlatformEnabled("TIKTOK")).toBe(false);
    expect(scope.isClientPlatformConnectionVisible("googleAds")).toBe(true);
    expect(scope.isClientPlatformConnectionVisible("ga4")).toBe(true);
    expect(scope.isClientPlatformConnectionVisible("tiktok")).toBe(false);
    expect(scope.isWizardPlatformSwitchEnabled()).toBe(true);
  });

  it("enables the six Meta v1 report types", () => {
    expect(LAUNCH_ENABLED_REPORT_TYPES).toEqual([
      "WEEKLY",
      "MONTHLY",
      "DAILY",
      "COMPARISON",
      "HISTORICAL",
      "DAY_BREAKDOWN",
    ]);
    for (const rt of ["QUARTER", "YTD", "CREATIVE"] as const) {
      expect(isLaunchReportTypeEnabled(rt)).toBe(false);
      expect(coerceLaunchReportType(rt)).toBe("WEEKLY");
    }
  });
});
