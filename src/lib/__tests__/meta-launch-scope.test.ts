import { describe, expect, it } from "vitest";
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
  it("keeps the report wizard Meta-only while exposing all connection management", () => {
    expect(LAUNCH_ENABLED_PLATFORMS).toEqual(["META"]);
    expect(isLaunchPlatformEnabled("META")).toBe(true);
    expect(isLaunchPlatformEnabled("GOOGLE")).toBe(false);
    expect(isLaunchPlatformEnabled("TIKTOK")).toBe(false);
    expect(isLaunchPlatformEnabled("GA4")).toBe(false);
    expect(isClientPlatformConnectionVisible("googleAds")).toBe(true);
    expect(isClientPlatformConnectionVisible("tiktok")).toBe(true);
    expect(isClientPlatformConnectionVisible("ga4")).toBe(true);
    expect(isWizardPlatformSwitchEnabled()).toBe(false);
  });

  it("coerces unknown platforms to Meta", () => {
    expect(coerceLaunchPlatform("UNKNOWN")).toBe("META");
  });

  it("enables standard and extended report types", () => {
    expect(LAUNCH_ENABLED_REPORT_TYPES).toEqual([
      "WEEKLY",
      "MONTHLY",
      "DAILY",
      "COMPARISON",
      "HISTORICAL",
      "DAY_BREAKDOWN",
      "QUARTER",
      "YTD",
      "CREATIVE",
    ]);
    for (const rt of ["QUARTER", "YTD", "CREATIVE"] as const) {
      expect(isLaunchReportTypeEnabled(rt)).toBe(true);
      expect(coerceLaunchReportType(rt)).toBe(rt);
    }
  });
});
