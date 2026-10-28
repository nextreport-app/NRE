import { describe, expect, it } from "vitest";
import { OBJECTIVE_DROPDOWN_OPTIONS } from "../result-type-map";
import { META_OBJECTIVE_SPECS } from "../meta-objective-dictionary";
import { allMetaCampaignObjectiveMatrixRows, objectiveKeyFromMatrixRow } from "../meta-campaign-objective-matrix";
import { filterObjectiveOptions } from "../objective-search";

describe("manual objective selection covers the Meta reference", () => {
  it("offers every dictionary objective exactly once, with RESULTS last", () => {
    const keys = OBJECTIVE_DROPDOWN_OPTIONS.map(option => option.key);
    for (const spec of META_OBJECTIVE_SPECS) expect(keys, spec.key).toContain(spec.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(OBJECTIVE_DROPDOWN_OPTIONS.map(option => option.resultLabel)).size).toBe(keys.length);
    expect(keys.at(-1)).toBe("results");
    expect(keys).toContain("donate");
    expect(keys).not.toContain("donations");
  });
  it("offers the mapped result for every performance-goal/conversion-event reference row", () => {
    const keys = new Set(OBJECTIVE_DROPDOWN_OPTIONS.map(option => option.key));
    for (const row of allMetaCampaignObjectiveMatrixRows()) {
      const key = objectiveKeyFromMatrixRow(row);
      expect(key, JSON.stringify(row)).not.toBeNull();
      expect(keys.has(key!), JSON.stringify(row)).toBe(true);
    }
  });
  it.each([
    ["contact", "contacts"], ["start trial", "trials_started"],
    ["2 second continuous", "video_2s_plays"], ["ThruPlay", "thruplays"],
    ["instant forms", "meta_form_leads"], ["Donate", "donate"],
    ["Sales", "purchases"], ["Awareness", "reach"], ["Submit application", "applications"],
  ])("finds %s using names, aliases, goals and categories", (query, key) => {
    expect(filterObjectiveOptions(OBJECTIVE_DROPDOWN_OPTIONS, query).map(option => option.key)).toContain(key);
  });
  it("retains order for empty queries and handles punctuation and no matches", () => {
    expect(filterObjectiveOptions(OBJECTIVE_DROPDOWN_OPTIONS, "  ")).toEqual(OBJECTIVE_DROPDOWN_OPTIONS);
    expect(filterObjectiveOptions(OBJECTIVE_DROPDOWN_OPTIONS, "2-SECOND").map(option => option.key)).toEqual(["video_2s_plays"]);
    expect(filterObjectiveOptions(OBJECTIVE_DROPDOWN_OPTIONS, "nonexistentxyz")).toEqual([]);
  });
});
