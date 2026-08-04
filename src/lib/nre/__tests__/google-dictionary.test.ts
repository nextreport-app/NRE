import { describe, it, expect } from "vitest";
import { findGoogleMetric, findGoogleMetricByKey, GOOGLE_METRIC_DICTIONARY } from "../google-dictionary";

describe("findGoogleMetric", () => {
  it("finds a primary metric by exact lowercase csvName", () => {
    expect(findGoogleMetric("cost")?.key).toBe("cost");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(findGoogleMetric("  Impr.  ")?.key).toBe("impressions");
  });

  it("returns undefined for an unrecognized column", () => {
    expect(findGoogleMetric("not a real column")).toBeUndefined();
  });
});

describe("findGoogleMetricByKey", () => {
  it("resolves an explanation for a secondary key", () => {
    const entry = findGoogleMetricByKey("roas");
    expect(entry?.label).toBe("ROAS");
    expect(entry?.explanation).toBeTruthy();
  });

  it("never matches a metadata/never-type entry", () => {
    expect(findGoogleMetricByKey("optimization_score")).toBeUndefined();
  });
});

describe("GOOGLE_METRIC_DICTIONARY — data integrity", () => {
  it("gives every primary/secondary entry a label, format, priority, and explanation", () => {
    for (const entry of GOOGLE_METRIC_DICTIONARY) {
      if (entry.type !== "primary" && entry.type !== "secondary") continue;
      expect(entry.label, `${entry.csvName} missing label`).toBeTruthy();
      expect(entry.format, `${entry.csvName} missing format`).toBeTruthy();
      expect(entry.priority, `${entry.csvName} missing priority`).toBeGreaterThan(0);
      expect(entry.explanation, `${entry.csvName} missing explanation`).toBeTruthy();
    }
  });

  // "all conv. rate" is the one legitimate duplicate here — it appears
  // twice in the source spec (once at priority 65 for search/
  // performance_max, once at priority 55 for search/shopping); the first
  // entry wins on lookup, matching findGoogleMetric's documented
  // first-match behavior. Every other csvName is unique.
  it("has no duplicate csvName entries other than the known 'all conv. rate' one", () => {
    const names = GOOGLE_METRIC_DICTIONARY.map((e) => e.csvName);
    const counts = new Map<string, number>();
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
    expect(duplicates).toEqual([["all conv. rate", 2]]);
  });
});
