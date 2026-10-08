import { describe, expect, it } from "vitest";
import {
  META_CSV_BASE_COLUMNS,
  metaCsvColumnsForObjectiveGroup,
} from "../meta-csv-export-guide";

describe("meta-csv-export-guide", () => {
  it("includes purchase funnel columns for purchase group", () => {
    const cols = metaCsvColumnsForObjectiveGroup("purchase");
    expect(cols.some((c) => /purchase roas/i.test(c))).toBe(true);
    expect(cols.length).toBeGreaterThan(META_CSV_BASE_COLUMNS.length);
  });

  it("base columns always include Day and Result type", () => {
    expect(META_CSV_BASE_COLUMNS).toContain("Day");
    expect(META_CSV_BASE_COLUMNS).toContain("Result type");
  });
});
