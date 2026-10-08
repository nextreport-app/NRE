import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { buildMetaSyncDiagnostics } from "../meta-api-sync/sync-diagnostics";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);

/**
 * Production panel (deploy f947c16): results[] on 30/30, objective 0, pixel in actions 26/30,
 * costed lead in results 0, sample actions include onsite_web_lead + fb_pixel_custom.
 */
function productionDiagnosticsF947Shape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
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
  if (manualResults === 1) {
    insight.results.push({
      indicator: "actions:offsite_conversion.fb_pixel_lead",
      values: [{ value: "1" }],
    });
  } else if (manualResults > 1) {
    insight.results.push({
      indicator: "actions:onsite_web_lead",
      values: [{ value: String(manualResults) }],
    });
  }

  const actions: { action_type: string; value: string }[] = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: String(offsiteA) },
  ];
  if (manualResults > 1) {
    actions.push({ action_type: "onsite_web_lead", value: String(manualResults) });
  }
  if (linkClicks > 0 && manualResults === 0) {
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: "1" });
  }
  insight.actions = actions;
  return insight;
}

describe("production diagnostics f947 (uncosted results + onsite_web_lead)", () => {
  it("maps 12 website submissions and diagnostics match panel shape", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const insights = rows.map(productionDiagnosticsF947Shape);
    const d = buildMetaSyncDiagnostics(insights);

    expect(d.rowsWithResultsField).toBe(insights.length);
    expect(d.rowsWithObjectiveResultsField).toBe(0);
    expect(d.rowsWithCostedLeadInResults).toBe(0);
    expect(d.rowsWithPixelInActions).toBeGreaterThan(20);

    let manualSum = 0;
    let apiSum = 0;
    for (let i = 0; i < rows.length; i++) {
      const expected = Number(rows[i].results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(insights[i]);
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(rows[i]._raw?.Day)).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(d.mappedResultsSum).toBe(12);
    expect(apiSum).toBe(12);
  });

  it("insightToManualCsvRow fills Result columns", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const resIdx = META_CSV_HEADERS.indexOf("Results");
    let total = 0;
    for (const row of rows) {
      total += Number(insightToManualCsvRow(productionDiagnosticsF947Shape(row))[resIdx]) || 0;
    }
    expect(total).toBe(12);
  });
});
