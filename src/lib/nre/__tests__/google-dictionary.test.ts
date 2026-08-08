import { describe, it, expect } from "vitest";
import { autoClassifyUnknownColumn, findGoogleMetric, findGoogleMetricByKey, GOOGLE_METRIC_DICTIONARY } from "../google-dictionary";

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

describe("Round B — new/aliased Google dictionary entries", () => {
  it("adds phone calls and the cost per result alias", () => {
    expect(findGoogleMetric("phone calls")?.key).toBe("phone_calls");
    expect(findGoogleMetric("cost per result")?.key).toBe("cost_per_conv");
    expect(findGoogleMetric("cost per result")?.perUnitOf).toBe("conversions");
  });

  it("widens results value's objectives to include performance_max", () => {
    const entry = findGoogleMetric("results value");
    expect(entry?.key).toBe("results_value");
    expect(entry?.objectives).toContain("performance_max");
  });

  it("existing aliases (avg. cost / conv. value per cost / search impr. share) are already present", () => {
    expect(findGoogleMetric("avg. cost")?.key).toBe("avg_cost");
    expect(findGoogleMetric("conv. value / cost")?.key).toBe("roas");
    expect(findGoogleMetric("search impr. share")?.key).toBe("search_impr_share");
  });
});

describe("Part 2 — autoClassifyUnknownColumn (Google)", () => {
  it("returns null for a column matching a skip pattern", () => {
    for (const col of ["Campaign status", "Budget name", "Currency code"]) {
      expect(autoClassifyUnknownColumn(col)).toBeNull();
    }
  });

  it("classifies a brand-new column as a low-priority secondary metric", () => {
    const entry = autoClassifyUnknownColumn("Some New Google Metric");
    expect(entry).not.toBeNull();
    expect(entry?.type).toBe("secondary");
    expect(entry?.priority).toBe(30);
    expect(entry?.label).toBe("SOME NEW GOOGLE METRIC");
    expect(entry?.key).toBe("some_new_google_metric");
  });

  it("auto-detects currency/ratio/percentage/number formats the same way as Meta's version", () => {
    expect(autoClassifyUnknownColumn("New Cost Field")?.format).toBe("currency");
    expect(autoClassifyUnknownColumn("Weird New ROAS Metric")?.format).toBe("ratio");
    expect(autoClassifyUnknownColumn("New Conv. Rate Variant")?.format).toBe("percentage");
    expect(autoClassifyUnknownColumn("Totally Unknown Field")?.format).toBe("number");
  });
});
