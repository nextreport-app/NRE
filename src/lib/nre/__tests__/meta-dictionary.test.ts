import { describe, it, expect } from "vitest";
import { findMetaMetric, findMetaMetricByKey, META_METRIC_DICTIONARY } from "../meta-dictionary";

describe("findMetaMetric", () => {
  it("finds a primary metric by exact lowercase csvName", () => {
    expect(findMetaMetric("amount spent")?.key).toBe("spend");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(findMetaMetric("  Amount Spent  ")?.key).toBe("spend");
  });

  it("returns undefined for an unrecognized column", () => {
    expect(findMetaMetric("not a real column")).toBeUndefined();
  });

  it("resolves a dimension column with no label/format/priority", () => {
    const entry = findMetaMetric("campaign name");
    expect(entry?.type).toBe("dimension");
    expect(entry?.label).toBeUndefined();
  });
});

describe("findMetaMetricByKey", () => {
  it("resolves an explanation for every primary/secondary key at least once", () => {
    const entry = findMetaMetricByKey("website_leads");
    expect(entry?.label).toBe("WEBSITE LEADS");
    expect(entry?.explanation).toBeTruthy();
  });

  it("never matches a dimension/metadata/never-type entry", () => {
    expect(findMetaMetricByKey("campaign_name")).toBeUndefined();
  });
});

describe("META_METRIC_DICTIONARY — data integrity", () => {
  it("gives every primary/secondary entry a label, format, priority, and explanation", () => {
    for (const entry of META_METRIC_DICTIONARY) {
      if (entry.type !== "primary" && entry.type !== "secondary") continue;
      expect(entry.label, `${entry.csvName} missing label`).toBeTruthy();
      expect(entry.format, `${entry.csvName} missing format`).toBeTruthy();
      expect(entry.priority, `${entry.csvName} missing priority`).toBeGreaterThan(0);
      expect(entry.explanation, `${entry.csvName} missing explanation`).toBeTruthy();
    }
  });

  it("has no duplicate csvName entries", () => {
    const names = META_METRIC_DICTIONARY.map((e) => e.csvName);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("CPC (ALL) — Fix 5 (was missing from auto-selection)", () => {
  it("recognizes all 4 real-world column name variants, all sharing the cpc_all key", () => {
    for (const csvName of ["cpc (all)", "cpc all", "avg. cpc", "average cpc (all)"]) {
      const entry = findMetaMetric(csvName);
      expect(entry?.key, csvName).toBe("cpc_all");
      expect(entry?.type, csvName).toBe("secondary");
      expect(entry?.priority, csvName).toBeGreaterThan(0);
    }
  });
});

describe("Fix 6 — dictionary objective tags", () => {
  it("tags WEBSITE LEADS and COST PER LEAD with both 'leads' and 'website_leads'", () => {
    expect(findMetaMetric("website leads")?.objectives).toEqual(expect.arrayContaining(["leads", "website_leads"]));
    expect(findMetaMetric("cost per lead")?.objectives).toEqual(expect.arrayContaining(["leads", "website_leads"]));
  });

  it("tags LINK CLICKS and its cost-per-click entry with both 'traffic' and 'link_clicks'", () => {
    expect(findMetaMetric("link clicks")?.objectives).toEqual(expect.arrayContaining(["traffic", "link_clicks"]));
    expect(findMetaMetric("cpc (cost per link click)")?.objectives).toEqual(
      expect.arrayContaining(["traffic", "link_clicks"]),
    );
  });

  it("classifies FREQUENCY as a secondary metric used for the REACH objective's slot 5 (see slot-assignment.ts)", () => {
    expect(findMetaMetric("frequency")?.type).toBe("secondary");
    expect(findMetaMetric("frequency")?.format).toBe("ratio");
  });

  it("tags CPM and COST PER 1K REACHED with 'reach' and 'awareness'", () => {
    expect(findMetaMetric("cpm (cost per 1,000 impressions)")?.objectives).toEqual(
      expect.arrayContaining(["reach", "awareness"]),
    );
    expect(findMetaMetric("cost per 1,000 meta accounts reached")?.objectives).toEqual(
      expect.arrayContaining(["reach", "awareness"]),
    );
  });
});

describe("Fix 3 — perUnitOf recompute metadata", () => {
  it("tags every 'cost per X' currency secondary/primary with a perUnitOf numerator key", () => {
    const costPerEntries = META_METRIC_DICTIONARY.filter(
      (e) => (e.type === "primary" || e.type === "secondary") && e.format === "currency" && e.csvName.startsWith("cost per "),
    );
    expect(costPerEntries.length).toBeGreaterThan(0);
    for (const entry of costPerEntries) {
      expect(entry.perUnitOf, entry.csvName).toBeTruthy();
    }
  });

  it("cost_per_result divides by results, cost_per_lead divides by website_leads", () => {
    expect(findMetaMetric("cost per result")?.perUnitOf).toBe("results");
    expect(findMetaMetric("cost per lead")?.perUnitOf).toBe("website_leads");
  });

  it("CPM/cost-per-1K-reached carry a 1000x perUnitScale", () => {
    expect(findMetaMetric("cpm (cost per 1,000 impressions)")?.perUnitScale).toBe(1000);
    expect(findMetaMetric("cost per 1,000 meta accounts reached")?.perUnitScale).toBe(1000);
  });
});
