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

/**
 * Live shape after #302 (Mapped 24): uncosted onsite_web_lead in results[] on many
 * blank manual days (2–4), incidental offsite pixel=1 in actions, results[] lead=1 daily.
 */
function inflatedLiveShape22c83(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;

  insight.cost_per_result = [];
  insight.cost_per_action_type = [];
  insight.objective_results = [];
  insight.cost_per_objective_result = [];

  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];

  const offsiteA = 1;
  const onsiteA =
    manualResults > 1
      ? manualResults
      : manualResults === 1
        ? 0
        : Math.min(Math.max(2, Math.floor(lpv * 0.7) || 2), 4);

  if (manualResults > 0) {
    if (manualResults === 1) {
      insight.results.push({
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: "1" }],
      });
    } else {
      insight.results.push({
        indicator: "actions:onsite_web_lead",
        values: [{ value: String(manualResults) }],
      });
    }
  } else {
    insight.results.push({
      indicator: "actions:onsite_web_lead",
      values: [{ value: String(onsiteA) }],
    });
  }

  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: String(offsiteA) },
  ];
  if (onsiteA > 0) {
    insight.actions.push({ action_type: "onsite_web_lead", value: String(onsiteA) });
  }
  return insight;
}

describe("inflated live shape (was 24 mapped, manual 12)", () => {
  it("maps each day to manual Results", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const day = String(row._raw?.Day ?? "");
      if (day < "2026-09-03") continue;
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(inflatedLiveShape22c83(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(apiSum).toBe(manualSum);
    expect(manualSum).toBe(10);
  });
});
