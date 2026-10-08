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

/** Meta sends costed website pixel in results[] only — no objective_results rows. */
function noObjectiveSoleCostedPixel(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  if (manualResults > 0) {
    const cpr = spend / manualResults;
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(manualResults) }],
      },
    ];
    insight.cost_per_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(cpr) }],
      },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.cost_per_result = [];
  }
  return insight;
}

describe("no objective_results — sole costed website in results[]", () => {
  it("maps lead days when Meta omits objective_results (sole costed pixel regression)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      const primary = manualExportPrimaryResult(noObjectiveSoleCostedPixel(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(apiSum).toBe(12);
  });
});
