import { describe, expect, it } from "vitest";
import {
  buildTikTokResultTypeAliases,
  normalizeTikTokResultTypeCell,
  resolveTikTokApiResultFields,
} from "../tiktok-objective-dictionary";
import { resolveObjectiveFromResultType } from "../result-type-map";

describe("tiktok-objective-dictionary", () => {
  it("resolves API metrics with dictionary priority", () => {
    expect(resolveTikTokApiResultFields({ conversion: "5", cost_per_conversion: "12.50", clicks: "100", reach: "5000" })).toEqual({
      resultType: "Conversions",
      results: "5",
      costPerResult: "12.50",
    });
    expect(resolveTikTokApiResultFields({ conversion: "0", reach: "10000", clicks: "50", spend: "200" }).resultType).toBe("Reach");
    expect(resolveTikTokApiResultFields({ conversion: "0", reach: "1000", clicks: "500", cpc: "0.45" }).resultType).toBe("Link clicks");
  });

  it("maps TikTok CSV result type cells and aliases into RESULT_TYPE_MAP", () => {
    expect(normalizeTikTokResultTypeCell("form submission")).toBe("Form submission");
    expect(resolveObjectiveFromResultType("Complete payment")?.resultLabel).toBe("PURCHASES");
    expect(buildTikTokResultTypeAliases()["video views"].resultLabel).toBe("VIDEO VIEWS");
  });
});
