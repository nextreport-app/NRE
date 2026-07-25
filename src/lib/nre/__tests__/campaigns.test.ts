import { describe, expect, it } from "vitest";
import { extractCampaignNames, filterRowsByCampaigns } from "../campaigns";
import type { NreRow } from "../columns";

function row(campaignName: string): NreRow {
  return { _raw: {}, campaign_name: campaignName };
}

describe("extractCampaignNames", () => {
  it("returns distinct campaign names in first-seen order", () => {
    const rows = [row("Shoes"), row("Boots"), row("Shoes"), row("Hats")];
    expect(extractCampaignNames(rows)).toEqual(["Shoes", "Boots", "Hats"]);
  });

  it("ignores blank/whitespace-only campaign names", () => {
    const rows = [row("Shoes"), row(""), row("   "), row("Boots")];
    expect(extractCampaignNames(rows)).toEqual(["Shoes", "Boots"]);
  });

  it("trims surrounding whitespace when comparing/de-duplicating", () => {
    const rows = [row("Shoes"), row("  Shoes  ")];
    expect(extractCampaignNames(rows)).toEqual(["Shoes"]);
  });

  it("returns an empty array for no rows", () => {
    expect(extractCampaignNames([])).toEqual([]);
  });
});

describe("filterRowsByCampaigns", () => {
  const rows = [row("Shoes"), row("Boots"), row("Hats")];

  it("keeps only rows whose campaign is in the selected set", () => {
    const result = filterRowsByCampaigns(rows, ["Shoes", "Hats"]);
    expect(result.map((r) => r.campaign_name)).toEqual(["Shoes", "Hats"]);
  });

  it("returns every row unfiltered when selection is null (no selection made)", () => {
    expect(filterRowsByCampaigns(rows, null)).toEqual(rows);
  });

  it("returns nothing when the selection is a deliberate empty array", () => {
    expect(filterRowsByCampaigns(rows, [])).toEqual([]);
  });

  it("matches campaign names ignoring surrounding whitespace", () => {
    const result = filterRowsByCampaigns(rows, ["  Shoes  "]);
    expect(result.map((r) => r.campaign_name)).toEqual(["Shoes"]);
  });
});
