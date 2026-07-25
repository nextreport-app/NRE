import { describe, expect, it } from "vitest";
import { adSetKey, extractAdSetGroups, filterRowsByAdSets, resolveDefaultSelectedAdSets } from "../ad-sets";
import type { NreRow } from "../columns";

function row(campaignName: string, adSetName: string): NreRow {
  return { _raw: {}, campaign_name: campaignName, ad_set_name: adSetName };
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

describe("resolveDefaultSelectedAdSets", () => {
  const groups = [
    { campaignName: "Shoes", adSetNames: ["Prospecting", "Retargeting"] },
    { campaignName: "Boots", adSetNames: ["Awareness"] },
  ];

  it("selects everything when nothing was previously excluded", () => {
    expect(resolveDefaultSelectedAdSets(groups, [])).toEqual([
      adSetKey("Shoes", "Prospecting"),
      adSetKey("Shoes", "Retargeting"),
      adSetKey("Boots", "Awareness"),
    ]);
  });

  it("excludes exactly the previously-deselected ad sets, keeping the rest selected", () => {
    const result = resolveDefaultSelectedAdSets(groups, [adSetKey("Shoes", "Retargeting")]);
    expect(result).toEqual([adSetKey("Shoes", "Prospecting"), adSetKey("Boots", "Awareness")]);
  });

  it("a brand new ad set (absent from the deselected list) defaults to selected", () => {
    // Simulates a later upload where "Shoes" gained a third ad set that
    // didn't exist when lastDeselectedAdSets was saved.
    const laterGroups = [
      { campaignName: "Shoes", adSetNames: ["Prospecting", "Retargeting", "Lookalike"] },
      { campaignName: "Boots", adSetNames: ["Awareness"] },
    ];
    const previouslyDeselected = [adSetKey("Shoes", "Retargeting")]; // saved before "Lookalike" existed
    const result = resolveDefaultSelectedAdSets(laterGroups, previouslyDeselected);
    expect(result).toContain(adSetKey("Shoes", "Lookalike")); // new ad set, defaults to selected
    expect(result).not.toContain(adSetKey("Shoes", "Retargeting")); // still excluded, as saved
    expect(result).toContain(adSetKey("Shoes", "Prospecting"));
    expect(result).toContain(adSetKey("Boots", "Awareness"));
  });

  it("saved deselections persist correctly across a full save/restore round trip", () => {
    // Round trip: user deselects "Retargeting", the selection route would
    // compute the excluded set as (all - selected) exactly like this...
    const allKeys = groups.flatMap((g) => g.adSetNames.map((name) => adSetKey(g.campaignName, name)));
    const userSelected = new Set(allKeys.filter((k) => k !== adSetKey("Shoes", "Retargeting")));
    const persistedDeselected = allKeys.filter((k) => !userSelected.has(k));
    expect(persistedDeselected).toEqual([adSetKey("Shoes", "Retargeting")]);

    // ...and on the next upload, resolveDefaultSelectedAdSets must restore
    // exactly that choice from the persisted (JSON round-tripped) value.
    const restored = JSON.parse(JSON.stringify(persistedDeselected));
    const result = resolveDefaultSelectedAdSets(groups, restored);
    expect(result).toEqual([adSetKey("Shoes", "Prospecting"), adSetKey("Boots", "Awareness")]);
  });
});
