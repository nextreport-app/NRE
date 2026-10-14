import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);

/** Meta sends counts in results[] but empty cost_per_result (Oct 2026 live reports). */
function uncostedResultsWithActionsPixel(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_result = [];
  insight.cost_per_action_type = [];
  if (manualResults > 0) {
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(manualResults) }],
      },
    ];
    insight.actions = [
      ...(insight.actions ?? []).filter((a) => a.action_type !== "offsite_conversion.fb_pixel_lead"),
      { action_type: "offsite_conversion.fb_pixel_lead", value: String(manualResults) },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  }
  return insight;
}

describe("empty cost_per_result — uncosted results + actions pixel", () => {
  it("maps to manual Results total", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      const primary = manualExportPrimaryResult(uncostedResultsWithActionsPixel(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(apiSum).toBe(12);
  });
});
