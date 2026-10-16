import { describe, expect, it } from "vitest";
import { resultBarColumns } from "../../pptx/chart-campaign-bars-render";
import { resultBarLayout } from "../../pptx/chart-slide-layout";
import { estimateTextWidthPt } from "../../pptx/text-fit";
import {
  buildCampaignShortLabels,
  fitCampaignNameForSingleBarLine,
  formatCampaignDisplayName,
  formatRankedCampaignLabel,
  maxCampaignNameCharsForSingleLine,
} from "../chart-campaign-labels";

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

  it("estimates single-line capacity from label width and font size", () => {
    expect(maxCampaignNameCharsForSingleLine(356, 15, 5)).toBeGreaterThan(35);
    expect(maxCampaignNameCharsForSingleLine(120, 12, 1)).toBeLessThan(24);
    expect(maxCampaignNameCharsForSingleLine(120, 12, 1)).toBeGreaterThan(10);
  });

  it("preserves the start of long campaign names when truncating for display", () => {
    const name = "Tractor - DC - Traffic Campaign Extra Long Name";
    expect(formatCampaignDisplayName(name)).toBe("Tractor - DC - Traffic Campaign Extra Long…");
    expect(formatCampaignDisplayName("Traffic - Tractor")).toBe("Traffic - Tractor");
  });

  it("keeps a long name untruncated when it fits the split-panel bar label column", () => {
    const cols = resultBarColumns(true);
    const layout = resultBarLayout(1, false);
    const labelWidthPt = cols.trackW;
    const short = "Website Retargeting";
    const fitted = fitCampaignNameForSingleBarLine(short, 1, labelWidthPt, layout.nameSizePt);
    expect(fitted).toBe(short);
  });

  it("shows more of Legacy-style campaign names with the full bar track width", () => {
    const cols = resultBarColumns(true);
    const layout = resultBarLayout(2, false);
    const narrowWidth = cols.trackW - 96;
    const fullWidth = cols.trackW;
    const name = "LegacyLifeProductions_WebsiteLeads_Remarketing";
    const narrow = fitCampaignNameForSingleBarLine(name, 1, narrowWidth, layout.nameSizePt);
    const wide = fitCampaignNameForSingleBarLine(name, 1, fullWidth, layout.nameSizePt);
    expect(wide.length).toBeGreaterThan(narrow.length);
    expect(estimateTextWidthPt(`1. ${wide}`, layout.nameSizePt)).toBeLessThanOrEqual(fullWidth);
  });

  it("truncates extremely long names before they would wrap behind the bar (regression)", () => {
    const cols = resultBarColumns(true);
    const layout = resultBarLayout(1, false);
    const labelWidthPt = cols.trackW;
    const longName =
      "New Leads campaign_Kaizen Homes - Website Performance Retargeting Broad Audience Test";
    const fitted = fitCampaignNameForSingleBarLine(longName, 1, labelWidthPt, layout.nameSizePt);
    expect(fitted.length).toBeLessThan(longName.length);
    expect(fitted).toMatch(/…$/);
    const line = `1. ${fitted}`;
    expect(estimateTextWidthPt(line, layout.nameSizePt)).toBeLessThanOrEqual(labelWidthPt);
  });
});
