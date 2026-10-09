import { describe, expect, it } from "vitest";
import {
  META_CSV_BASE_COLUMNS,
  META_CSV_HELP_BASE,
  META_CSV_IMPORT_TOOLTIP,
  metaCsvColumnsForObjectiveGroup,
} from "../meta-csv-export-guide";

describe("meta-csv-export-guide", () => {
  it("includes purchase funnel columns for purchase group", () => {
    const cols = metaCsvColumnsForObjectiveGroup("purchase");
    expect(cols.some((c) => /purchase roas/i.test(c))).toBe(true);
    expect(cols.length).toBeGreaterThan(META_CSV_BASE_COLUMNS.length);
  });

  it("import tooltip lists common Meta metrics", () => {
    expect(META_CSV_IMPORT_TOOLTIP.metrics).toContain("Amount spent");
    expect(META_CSV_IMPORT_TOOLTIP.body).toMatch(/Ads Reporting/i);
  });

  it("help page base list includes core spend and results columns", () => {
    expect(META_CSV_HELP_BASE.metrics).toContain("Amount spent");
    expect(META_CSV_HELP_BASE.metrics).toContain("CTR (all)");
  });

  it("base columns always include Day and Result type", () => {
    expect(META_CSV_BASE_COLUMNS).toContain("Day");
    expect(META_CSV_BASE_COLUMNS).toContain("Result type");
  });
});
