import { describe, expect, it } from "vitest";
import { extractCampaignNames, filterRowsByCampaigns, resolveCampaignSelection } from "../campaigns";
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

describe("resolveCampaignSelection — Campaigns step is always shown, only the pre-checked default varies", () => {
  it("a single campaign still gets the full step ('choose'), not a silent skip", () => {
    const result = resolveCampaignSelection(["Shoes"], null);
    expect(result).toEqual({ selectedCampaigns: ["Shoes"], stepMode: "choose" });
  });

  it("a single campaign with saved memory still gets the full step ('returning'), pre-checked from that memory", () => {
    const result = resolveCampaignSelection(["Shoes"], { campaigns: ["Shoes"], deselected: ["Shoes"] });
    expect(result).toEqual({ selectedCampaigns: [], stepMode: "returning" });
  });

  it("no saved memory (first upload for this client): 'choose', everything pre-checked by default", () => {
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats"], null);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots", "Hats"], stepMode: "choose" });
  });

  it("a saved selection with nothing excluded: 'returning', everything still pre-checked", () => {
    const memory = { campaigns: ["Shoes", "Boots", "Hats", "Belts"], deselected: [] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats", "Belts"], memory);
    expect(result).toEqual({
      selectedCampaigns: ["Shoes", "Boots", "Hats", "Belts"],
      stepMode: "returning",
    });
  });

  it("a saved selection with some excluded: 'returning', pre-checked minus the excluded ones", () => {
    const memory = { campaigns: ["Shoes", "Boots", "Hats"], deselected: ["Hats"] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats"], memory);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots"], stepMode: "returning" });
  });

  it("a brand-new campaign name (absent from the saved memory's own campaign list) defaults to pre-checked", () => {
    const memory = { campaigns: ["Shoes", "Boots"], deselected: [] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Sandals"], memory);
    expect(result.stepMode).toBe("returning");
    // Old exclusions still carry forward as the pre-checked default — a new campaign
    // isn't a reason to also re-litigate campaigns the user already decided on.
    expect(result.selectedCampaigns).toEqual(["Shoes", "Boots", "Sandals"]);
  });

  it("a campaign that vanished from this week's CSV is simply absent from the result — no special casing needed", () => {
    // Last time: Shoes, Boots, Hats (Hats excluded). This week Hats simply
    // isn't in the file at all — just a smaller upload.
    const memory = { campaigns: ["Shoes", "Boots", "Hats"], deselected: ["Hats"] };
    const result = resolveCampaignSelection(["Shoes", "Boots"], memory);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots"], stepMode: "returning" });
  });
});
