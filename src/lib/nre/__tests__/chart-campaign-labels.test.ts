import { describe, expect, it } from "vitest";
import { buildCampaignShortLabels, formatRankedCampaignLabel } from "../chart-campaign-labels";

describe("buildCampaignShortLabels", () => {
  it("strips a shared prefix so similar campaign names stay distinguishable", () => {
    const names = [
      "Sherwood Tractor Sales | LPV Campaign A",
      "Sherwood Tractor Sales | LPV Campaign B",
      "Sherwood Tractor Parts | LPV Campaign C",
      "Sherwood Tractor Events | LPV Campaign D",
    ];
    const labels = buildCampaignShortLabels(names);
    expect(labels.get(names[0]!)).toBe("LPV Campaign A");
    expect(labels.get(names[1]!)).toBe("LPV Campaign B");
    expect(labels.get(names[2]!)).toBe("LPV Campaign C");
    expect(labels.get(names[3]!)).toBe("LPV Campaign D");
  });

  it("uses suffix after common prefix when delimiter tails are identical", () => {
    const names = [
      "Sherwood Tractor Sales LPV 2026 Q3 Alpha",
      "Sherwood Tractor Sales LPV 2026 Q3 Beta",
      "Sherwood Tractor Sales LPV 2026 Q3 Gamma",
    ];
    const labels = buildCampaignShortLabels(names);
    expect(labels.get(names[0]!)).toBe("Alpha");
    expect(labels.get(names[1]!)).toBe("Beta");
    expect(labels.get(names[2]!)).toBe("Gamma");
  });

  it("falls back to a unique tail when delimiter tails still collide", () => {
    const names = [
      "Brand Campaign Alpha Variant",
      "Brand Campaign Beta Variant",
    ];
    const labels = buildCampaignShortLabels(names);
    expect(labels.get(names[0]!)).not.toBe(labels.get(names[1]!));
  });

  it("formats ranked labels for chart rows", () => {
    expect(formatRankedCampaignLabel(1, "LPV Campaign A")).toBe("1. LPV Campaign A");
  });
});
