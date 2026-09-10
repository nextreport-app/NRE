import { describe, expect, it } from "vitest";
import { isIndiaCountryCode, shouldShowTikTokToVisitor } from "../visitor-geo";

describe("visitor-geo", () => {
  it("treats IN as India", () => {
    expect(isIndiaCountryCode("IN")).toBe(true);
    expect(isIndiaCountryCode("in")).toBe(false);
  });

  it("hides TikTok for India only", () => {
    expect(shouldShowTikTokToVisitor("IN")).toBe(false);
    expect(shouldShowTikTokToVisitor("US")).toBe(true);
    expect(shouldShowTikTokToVisitor("GB")).toBe(true);
    expect(shouldShowTikTokToVisitor(null)).toBe(true);
    expect(shouldShowTikTokToVisitor(undefined)).toBe(true);
  });
});
