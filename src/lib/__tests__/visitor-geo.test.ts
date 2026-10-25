import { describe, expect, it } from "vitest";
import { isIndiaCountryCode, shouldShowTikTokToVisitor } from "../visitor-geo";

describe("visitor geo", () => {
  it("detects India country code", () => {
    expect(isIndiaCountryCode("IN")).toBe(true);
    expect(isIndiaCountryCode("US")).toBe(false);
  });

  it("shows TikTok option in all regions", () => {
    expect(shouldShowTikTokToVisitor("IN")).toBe(true);
    expect(shouldShowTikTokToVisitor("US")).toBe(true);
    expect(shouldShowTikTokToVisitor("GB")).toBe(true);
    expect(shouldShowTikTokToVisitor(null)).toBe(true);
    expect(shouldShowTikTokToVisitor(undefined)).toBe(true);
  });
});
