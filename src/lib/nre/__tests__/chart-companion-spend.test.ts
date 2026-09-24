import { describe, expect, it } from "vitest";
import { buildCompanionSpendSegments } from "../chart-companion-spend";

describe("buildCompanionSpendSegments", () => {
  it("prefers ad-set spend mix when multiple ad sets exist", () => {
    const rows = [
      { _raw: { Day: "16-09-2026" }, ad_set_name: "Prospecting", spend: "400" },
      { _raw: { Day: "16-09-2026" }, ad_set_name: "Retargeting", spend: "330" },
    ];
    const segments = buildCompanionSpendSegments(rows);
    expect(segments).toHaveLength(2);
    expect(segments[0]?.name).toBe("Prospecting");
    expect(segments[0]?.spend).toBe(400);
  });
});
