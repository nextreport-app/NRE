import { describe, expect, it } from "vitest";
import { adSetKey, extractAdSetGroups, extractSpendingAdSetGroups, filterRowsByAdSets } from "../ad-sets";
import { resolveDefaultSelectedAdSets, buildAdSetSlidePreferences, newAdSetSlideKeys, activeAdSetKeys, supportsAdSetSlides } from "../ad-set-slide-preferences";
import type { NreRow } from "../columns";

function row(campaignName: string, adSetName: string): NreRow {
  return { _raw: {}, campaign_name: campaignName, ad_set_name: adSetName };
}

function rowWithSpend(campaignName: string, adSetName: string, spend: number): NreRow {
  return { _raw: {}, campaign_name: campaignName, ad_set_name: adSetName, spend: String(spend) };
}

describe("extractAdSetGroups", () => {
  it("groups distinct ad sets by their parent campaign, both in first-seen order", () => {
    const rows = [
      row("Brisbane South - cold traffic", "broad"),
      row("Brisbane North - Remarketing", "all audiences"),
      row("Brisbane South - cold traffic", "interest"),
      row("Brisbane South - cold traffic", "broad"), // duplicate, ignored
    ];
    expect(extractAdSetGroups(rows)).toEqual([
      { campaignName: "Brisbane South - cold traffic", adSetNames: ["broad", "interest"] },
      { campaignName: "Brisbane North - Remarketing", adSetNames: ["all audiences"] },
    ]);
  });

  it("still reports a campaign with only one ad set as its own group — never skipped", () => {
    const rows = [row("Solo Campaign", "Only Ad Set")];
    expect(extractAdSetGroups(rows)).toEqual([{ campaignName: "Solo Campaign", adSetNames: ["Only Ad Set"] }]);
  });

  it("ignores rows with a blank campaign or ad set name", () => {
    const rows = [row("Shoes", ""), row("", "Retargeting"), row("Shoes", "Prospecting")];
    expect(extractAdSetGroups(rows)).toEqual([{ campaignName: "Shoes", adSetNames: ["Prospecting"] }]);
  });

  it("trims surrounding whitespace when comparing/de-duplicating", () => {
    const rows = [row("Shoes", "Prospecting"), row("Shoes", "  Prospecting  ")];
    expect(extractAdSetGroups(rows)).toEqual([{ campaignName: "Shoes", adSetNames: ["Prospecting"] }]);
  });

  it("returns an empty array for no rows", () => {
    expect(extractAdSetGroups([])).toEqual([]);
  });
});

describe("extractSpendingAdSetGroups", () => {
  it("excludes ad sets whose total spend across the CSV is zero, keeping the rest", () => {
    const rows = [
      rowWithSpend("Shoes", "Prospecting", 100),
      rowWithSpend("Shoes", "Retargeting", 0), // never spent — long paused
      rowWithSpend("Boots", "Awareness", 50),
    ];
    expect(extractSpendingAdSetGroups(rows)).toEqual([{ campaignName: "Shoes", adSetNames: ["Prospecting"] }, { campaignName: "Boots", adSetNames: ["Awareness"] }]);
  });

  it("sums an ad set's spend across multiple daily rows before comparing to the threshold", () => {
    const rows = [
      rowWithSpend("Shoes", "Prospecting", 0.005),
      rowWithSpend("Shoes", "Prospecting", 0.006), // sums to 0.011 — just over the cent threshold
    ];
    expect(extractSpendingAdSetGroups(rows)).toEqual([{ campaignName: "Shoes", adSetNames: ["Prospecting"] }]);
  });

  it("omits a campaign entirely when none of its ad sets have real spend", () => {
    const rows = [rowWithSpend("Shoes", "Prospecting", 0), rowWithSpend("Boots", "Awareness", 20)];
    expect(extractSpendingAdSetGroups(rows)).toEqual([{ campaignName: "Boots", adSetNames: ["Awareness"] }]);
  });

  it("returns an empty array when no ad set has any real spend", () => {
    const rows = [rowWithSpend("Shoes", "Prospecting", 0)];
    expect(extractSpendingAdSetGroups(rows)).toEqual([]);
  });

  it("preserves first-seen order, same as extractAdSetGroups", () => {
    const rows = [rowWithSpend("Boots", "Awareness", 20), rowWithSpend("Shoes", "Retargeting", 30), rowWithSpend("Shoes", "Prospecting", 10)];
    expect(extractSpendingAdSetGroups(rows)).toEqual([
      { campaignName: "Boots", adSetNames: ["Awareness"] },
      { campaignName: "Shoes", adSetNames: ["Retargeting", "Prospecting"] },
    ]);
  });
});

describe("filterRowsByAdSets", () => {
  const rows = [
    row("Shoes", "Prospecting"),
    row("Shoes", "Retargeting"),
    row("Boots", "Prospecting"), // same ad set NAME as Shoes/Prospecting, different campaign
  ];

  it("keeps only rows whose composite campaign+ad-set key is selected", () => {
    const result = filterRowsByAdSets(rows, [adSetKey("Shoes", "Prospecting")]);
    expect(result).toEqual([row("Shoes", "Prospecting")]);
  });

  it("does not confuse same-named ad sets across different campaigns", () => {
    // "Prospecting" exists under both Shoes and Boots — selecting only
    // Boots' copy must not accidentally also pull in Shoes' rows.
    const result = filterRowsByAdSets(rows, [adSetKey("Boots", "Prospecting")]);
    expect(result).toEqual([row("Boots", "Prospecting")]);
  });

  it("returns every row unfiltered when selection is null (no selection made)", () => {
    expect(filterRowsByAdSets(rows, null)).toEqual(rows);
  });

  it("returns nothing when the selection is a deliberate empty array", () => {
    expect(filterRowsByAdSets(rows, [])).toEqual([]);
  });

  it("removes every row for a campaign when all of its ad sets are excluded, leaving other campaigns untouched", () => {
    const result = filterRowsByAdSets(rows, [adSetKey("Boots", "Prospecting")]);
    expect(result.some((r) => r.campaign_name === "Shoes")).toBe(false);
    expect(result.map((r) => r.campaign_name)).toEqual(["Boots"]);
  });
});

describe("optional ad-set slide preferences", () => {
  const groups = [
    { campaignName: "Shoes", adSetNames: ["Prospecting", "Retargeting"] },
    { campaignName: "Boots", adSetNames: ["Awareness"] },
  ];
  it("leaves both single and multiple ad sets unchecked on a fresh import", () => {
    expect(resolveDefaultSelectedAdSets(groups)).toEqual([]);
    expect(newAdSetSlideKeys(groups)).toEqual([]);
  });
  it("does not reinterpret old exclusion arrays or malformed memory as opt-ins", () => {
    for (const raw of ["[]", JSON.stringify([adSetKey("Shoes", "Retargeting")]), "invalid", '{"policy":"wrong"}']) {
      expect(resolveDefaultSelectedAdSets(groups, raw)).toEqual([]);
    }
  });
  it("restores exactly the user's explicit inclusions across JSON save/restore", () => {
    const keys = [adSetKey("Shoes", "Prospecting"), adSetKey("Boots", "Awareness")];
    const memory = JSON.stringify(buildAdSetSlidePreferences(groups, keys));
    expect(resolveDefaultSelectedAdSets(groups, memory)).toEqual(keys);
  });
  it("retains an explicit all-unchecked choice on the next import", () => {
    const memory = JSON.stringify(buildAdSetSlidePreferences(groups, []));
    expect(resolveDefaultSelectedAdSets(groups, memory)).toEqual([]);
    expect(newAdSetSlideKeys(groups, memory)).toEqual([]);
  });
  it("leaves new ad sets unchecked and labels only newly discovered keys", () => {
    const memory = JSON.stringify(buildAdSetSlidePreferences(groups, [adSetKey("Shoes", "Prospecting")]));
    const later = [{ campaignName: "Shoes", adSetNames: ["Prospecting", "Retargeting", "Lookalike"] }, groups[1]];
    expect(resolveDefaultSelectedAdSets(later, memory)).toEqual([adSetKey("Shoes", "Prospecting")]);
    expect(newAdSetSlideKeys(later, memory)).toEqual([adSetKey("Shoes", "Lookalike")]);
  });
  it("remembers a temporarily absent ad set without confusing same-named sets in other campaigns", () => {
    const old = JSON.stringify(buildAdSetSlidePreferences(groups, [adSetKey("Boots", "Awareness")]));
    const now = JSON.stringify(buildAdSetSlidePreferences([groups[0]], [adSetKey("Shoes", "Prospecting")], old));
    expect(resolveDefaultSelectedAdSets(groups, now)).toEqual([adSetKey("Shoes", "Prospecting"), adSetKey("Boots", "Awareness")]);
  });
  it("drops unknown selection keys rather than persisting invented opt-ins", () => {
    expect(buildAdSetSlidePreferences(groups, [adSetKey("Other", "Unknown")]).selectedKeys).toEqual([]);
  });
  it("excludes ad-set selections whose parent campaign is excluded", () => {
    const chosen = new Set([adSetKey("Shoes", "Prospecting"), adSetKey("Boots", "Awareness")]);
    expect(activeAdSetKeys(groups, chosen, new Set(["Boots"]))).toEqual([adSetKey("Boots", "Awareness")]);
  });
  it.each(["COMPARISON", "DAY_BREAKDOWN"])("does not offer separate ad-set slides for %s", type => expect(supportsAdSetSlides(type)).toBe(false));
});
