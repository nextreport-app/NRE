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

/** Live panel: results[] only actions:lead; no offsite/onsite in results; website in actions[]. */
function liveShapeNoOffsiteInResults(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  insight.cost_per_result = [];
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];

  const actions: { action_type: string; value: string }[] = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
  ];
  if (linkClicks > 0 || manualResults > 0) {
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: "1" });
  }
  if (manualResults > 0) {
    actions.push({ action_type: "onsite_web_lead", value: String(manualResults) });
    const spend = Number(row.spend) || 0;
    insight.results = [
      { indicator: "actions:lead", values: [{ value: String(manualResults) }] },
    ];
    insight.cost_per_result = [
      {
        indicator: "actions:lead",
        values: [{ value: String(spend / manualResults) }],
      },
    ];
  }
  insight.actions = actions;
  return insight;
}

describe("live shape without website metrics in results[]", () => {
  it("maps manual website submission totals", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(liveShapeNoOffsiteInResults(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });
});
