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

describe("resolveCampaignSelection — report upload wizard's smart Campaigns-step skip", () => {
  it("a single campaign always skips silently and includes it, ignoring any past exclusion", () => {
    const result = resolveCampaignSelection(["Shoes"], { campaigns: ["Shoes"], deselected: ["Shoes"] });
    expect(result).toEqual({ selectedCampaigns: ["Shoes"], stepMode: "skip" });
  });

  it("a single campaign with no saved memory at all still skips silently", () => {
    expect(resolveCampaignSelection(["Shoes"], null)).toEqual({ selectedCampaigns: ["Shoes"], stepMode: "skip" });
  });

  it("no saved memory (first upload for this client) always shows the full step, everything selected by default", () => {
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats"], null);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots", "Hats"], stepMode: "choose" });
  });

  it("a saved selection with no new campaigns skips the full step and reuses it, even when it was everything", () => {
    const memory = { campaigns: ["Shoes", "Boots", "Hats", "Belts"], deselected: [] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats", "Belts"], memory);
    expect(result).toEqual({
      selectedCampaigns: ["Shoes", "Boots", "Hats", "Belts"],
      stepMode: "confirm",
    });
  });

  it("a saved selection with no new campaigns skips the full step and reuses a partial selection", () => {
    const memory = { campaigns: ["Shoes", "Boots", "Hats"], deselected: ["Hats"] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Hats"], memory);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots"], stepMode: "confirm" });
  });

  it("a brand-new campaign name (absent from the saved memory's own campaign list) forces the full step", () => {
    const memory = { campaigns: ["Shoes", "Boots"], deselected: [] };
    const result = resolveCampaignSelection(["Shoes", "Boots", "Sandals"], memory);
    expect(result.stepMode).toBe("choose");
    // Old exclusions still carry forward as the pre-checked default on that full step — a new campaign
    // isn't a reason to also re-litigate campaigns the user already decided on.
    expect(result.selectedCampaigns).toEqual(["Shoes", "Boots", "Sandals"]);
  });

  it("a campaign that vanished from this week's CSV isn't treated as 'new' — no false positive on the full step", () => {
    // Last time: Shoes, Boots, Hats (Hats excluded). This week Hats simply
    // isn't in the file at all — that's not a new campaign, just a smaller
    // upload, so it must still skip straight to the confirm banner.
    const memory = { campaigns: ["Shoes", "Boots", "Hats"], deselected: ["Hats"] };
    const result = resolveCampaignSelection(["Shoes", "Boots"], memory);
    expect(result).toEqual({ selectedCampaigns: ["Shoes", "Boots"], stepMode: "confirm" });
  });
});
