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

  it("offers only the two tested report workflows", () => {
    expect(LAUNCH_ENABLED_REPORT_TYPES).toEqual(["WEEKLY", "COMPARISON"]);
    for (const rt of ["MONTHLY", "DAILY", "HISTORICAL", "DAY_BREAKDOWN", "QUARTER", "YTD", "CREATIVE"]) {
      expect(isLaunchReportTypeEnabled(rt)).toBe(false);
      expect(coerceLaunchReportType(rt)).toBe("WEEKLY");
    }
    expect(coerceLaunchReportType("COMPARISON")).toBe("COMPARISON");
  });
});
