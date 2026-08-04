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
