import { describe, expect, it } from "vitest";
import { resolveTikTokApiResultFields } from "../tiktok-result-type";

describe("resolveTikTokApiResultFields", () => {
  it("uses Conversions when conversion count is positive", () => {
    const out = resolveTikTokApiResultFields({
      conversion: "5",
      cost_per_conversion: "12.50",
      clicks: "100",
      reach: "5000",
    });
    expect(out.resultType).toBe("Conversions");
    expect(out.results).toBe("5");
    expect(out.costPerResult).toBe("12.50");
  });

  it("uses Reach when reach dominates and there are no conversions", () => {
    const out = resolveTikTokApiResultFields({
      conversion: "0",
      reach: "10000",
      clicks: "50",
      spend: "200",
    });
    expect(out.resultType).toBe("Reach");
    expect(out.results).toBe("10000");
  });

  it("falls back to Link clicks for traffic campaigns", () => {
    const out = resolveTikTokApiResultFields({
      conversion: "0",
      reach: "1000",
      clicks: "500",
      cpc: "0.45",
    });
    expect(out.resultType).toBe("Link clicks");
    expect(out.results).toBe("500");
    expect(out.costPerResult).toBe("0.45");
  });
});
