import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026.csv",
);

/** Meta payload shape that produced inflated API CSV (Sep 2026 Credit Firm production). */
function inflatedProductionInsight(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const results = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const rt = String(row.result_type ?? "").toLowerCase();
  const linkClicks = Number(row.link_clicks) || 0;

  if (results > 0 && rt.includes("website")) {
    const cpr = spend / results;
    insight.objective_results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(results) }],
      },
    ];
    insight.cost_per_objective_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(cpr) }],
      },
    ];
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(Math.max(linkClicks, results * 4)) }],
      },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  }
  insight.cost_per_result = [];
  return insight;
}

describe("Credit Firm API inflation regression (Sep 2026 production)", () => {
  it("ignores uncosted/conversion_leads noise and matches manual Results per day", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      const primary = manualExportPrimaryResult(inflatedProductionInsight(row));
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got).toBe(expected);
    }
  });

  it("lead day with 12 link clicks still exports 3 results not 12", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const leadDay = rows.find((r) => Number(r.results) === 3 && String(r.result_type).includes("website"));
    expect(leadDay).toBeTruthy();

    const csvRow = insightToManualCsvRow(inflatedProductionInsight(leadDay!));
    const resultsIdx = META_CSV_HEADERS.indexOf("Results");
    expect(Number(csvRow[resultsIdx])).toBe(3);
  });
});
