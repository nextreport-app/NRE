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

const CUSTOM_INDICATOR = "actions:offsite_conversion.custom.446052571654985";

/** Live b15962a: campaign merges costed custom conversion in results[] (8 lead days in API). */
function panelB15962aShape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;

  insight.objective_results = [];
  insight.cost_per_action_type = [];
  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  insight.cost_per_result = [];

  if (manualResults > 0) {
    insight.results = [
      { indicator: CUSTOM_INDICATOR, values: [{ value: String(manualResults) }] },
    ];
    insight.cost_per_result = [
      { indicator: CUSTOM_INDICATOR, values: [{ value: String(spend / manualResults) }] },
    ];
  }

  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
    { action_type: "onsite_web_lead", value: String(manualResults > 0 ? manualResults : 1) },
  ];
  return insight;
}

describe("panel b15962a (costed custom in results[])", () => {
  it("maps each manual lead day from costed custom conversion (no CPA false positives)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const day = String(row._raw?.Day ?? "");
      if (day < "2026-09-03") continue;
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(panelB15962aShape(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, day).toBe(expected);
      if (expected > 0) {
        expect(primary?.csvResultType).toBe("website submission");
      }
    }
    expect(manualSum).toBe(10);
    expect(apiSum).toBe(10);
  });

  it("does not map blank manual days that only had CPA parity (Sep 10, 14, 24, 29)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    for (const blankDay of ["2026-09-10", "2026-09-14", "2026-09-24", "2026-09-29"]) {
      const row = rows.find((r) => String(r._raw?.Day) === blankDay);
      expect(row && Number(row.results) === 0).toBe(true);
      expect(manualExportPrimaryResult(panelB15962aShape(row!))).toBeNull();
    }
  });
});
