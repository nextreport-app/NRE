import { describe, expect, it } from "vitest";
import { isIndiaCountryCode, shouldShowTikTokToVisitor } from "../visitor-geo";

describe("visitor geo", () => {
  it("detects India country code", () => {
    expect(isIndiaCountryCode("IN")).toBe(true);
    expect(isIndiaCountryCode(" in ")).toBe(true);
    expect(isIndiaCountryCode("US")).toBe(false);
  });

  it("limits TikTok outside India without treating unknown location as India", () => {
    expect(shouldShowTikTokToVisitor("IN")).toBe(false);
    expect(shouldShowTikTokToVisitor("US")).toBe(true);
    expect(shouldShowTikTokToVisitor("GB")).toBe(true);
    expect(shouldShowTikTokToVisitor(null)).toBe(true);
    expect(shouldShowTikTokToVisitor(undefined)).toBe(true);
  });
});
