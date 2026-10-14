import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);

/**
 * Oct 2026 production: Meta sends costed combined `lead` on objective_results daily,
 * costed website pixel in results[] on lead days, empty cost_per_objective for website.
 * Prior mapper blocked all results[] website picks when any objective costed row existed → 0 API CSV.
 */
function productionObjectiveLeadPlusCostedPixelResults(
  row: ReturnType<typeof parseCsvText>["rows"][number],
) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;

  insight.cost_per_action_type = [];
  insight.objective_results = [
    {
      indicator: "actions:lead",
      values: [{ value: manualResults > 0 ? String(manualResults) : "1" }],
    },
  ];
  insight.cost_per_objective_result = [
    {
      indicator: "actions:lead",
      values: [{ value: String(spend > 0 && manualResults > 0 ? spend / manualResults : spend || 1) }],
    },
  ];

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
    insight.actions = [
      ...(insight.actions ?? []).filter((a) => a.action_type !== "offsite_conversion.fb_pixel_lead"),
      { action_type: "offsite_conversion.fb_pixel_lead", value: String(manualResults) },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.cost_per_result = [];
    if (linkClicks > 0) {
      insight.actions = [
        ...(insight.actions ?? []),
        { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
      ];
    }
  }

  return insight;
}

describe("Credit Firm API zero CSV (objective lead blocks results channel)", () => {
  it("maps every day to manual Results (12 total)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(productionObjectiveLeadPlusCostedPixelResults(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });

  it("insightToManualCsvRow is not all blank (regression: uploaded meta-api-sync zero file)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const resIdx = META_CSV_HEADERS.indexOf("Results");
    let total = 0;
    for (const row of rows) {
      const csvRow = insightToManualCsvRow(productionObjectiveLeadPlusCostedPixelResults(row));
      total += Number(csvRow[resIdx]) || 0;
    }
    expect(total).toBe(12);
  });
});
