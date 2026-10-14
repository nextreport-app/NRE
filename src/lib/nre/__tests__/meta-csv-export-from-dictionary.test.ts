import { describe, expect, it } from "vitest";
import {
  buildMetaExportBaseColumns,
  buildMetaExportExtraColumnsForObjectives,
  buildMetaCsvObjectiveColumnGroups,
} from "../meta-csv-export-from-dictionary";
import { metaCsvColumnsForObjectiveGroup, META_CSV_BASE_COLUMNS } from "../meta-csv-export-guide";

describe("meta-csv-export-from-dictionary", () => {
  it("base columns include structure + primary metrics from dictionary", () => {
    const base = buildMetaExportBaseColumns();
    expect(base).toContain("Campaign name");
    expect(base).toContain("Day");
    expect(base).toContain("Result type");
    expect(base).toContain("Amount spent");
    expect(base).toEqual(META_CSV_BASE_COLUMNS);
  });

  it("sales objective extras include purchase funnel metrics", () => {
    const extras = buildMetaExportExtraColumnsForObjectives(["sales"]);
    expect(extras.some((c) => /roas/i.test(c))).toBe(true);
    expect(extras.some((c) => /add to cart/i.test(c))).toBe(true);
  });

  it("purchase group merges base + dictionary extras", () => {
    const cols = metaCsvColumnsForObjectiveGroup("purchase");
    expect(cols.length).toBeGreaterThan(META_CSV_BASE_COLUMNS.length);
    expect(cols).toContain("Amount spent");
  });

  it("objective groups are built for every picker spec", () => {
    const groups = buildMetaCsvObjectiveColumnGroups();
    expect(groups.length).toBeGreaterThanOrEqual(8);
    expect(groups.every((g) => Array.isArray(g.columns))).toBe(true);
  });
});
