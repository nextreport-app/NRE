import { describe, expect, it } from "vitest";
import {
  coerceLaunchPlatform,
  coerceLaunchReportType,
  isLaunchPlatformEnabled,
  isLaunchReportTypeEnabled,
  LAUNCH_ENABLED_PLATFORMS,
  LAUNCH_ENABLED_REPORT_TYPES,
} from "../meta-launch-scope";

describe("meta launch scope", () => {
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
