import { describe, expect, it } from "vitest";
import { isPlatformBeta, platformBetaCardNote } from "../platform-beta";

describe("platform beta status", () => {
  it("marks Meta as production-ready", () => {
    expect(isPlatformBeta("META")).toBe(false);
    expect(platformBetaCardNote("META")).toBeNull();
  });

  it("marks Google, TikTok, and GA4 as beta", () => {
    for (const platform of ["GOOGLE", "TIKTOK", "GA4"] as const) {
      expect(isPlatformBeta(platform)).toBe(true);
      expect(platformBetaCardNote(platform)).toContain("Beta");
    }
  });
});
