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

/** Live shape: costed objective actions:lead=1 daily, costed pixel in results[] = manual count on lead days. */
function objectiveLeadOneCostedPixelMatchesManual(
  row: ReturnType<typeof parseCsvText>["rows"][number],
) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;

  insight.cost_per_action_type = [];
  insight.objective_results = [
    { indicator: "actions:lead", values: [{ value: "1" }] },
  ];
  insight.cost_per_objective_result = [
    {
      indicator: "actions:lead",
      values: [{ value: String(spend > 0 ? spend : 1) }],
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
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.cost_per_result = [];
  }

  return insight;
}

describe("Credit Firm objective lead count != website pixel (production zero regression)", () => {
  it("uses costed website pixel from results[] when objective lead is always 1", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(objectiveLeadOneCostedPixelMatchesManual(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, String(row._raw?.Day)).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });

  it("insightToManualCsvRow totals 12 website submissions", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const resIdx = META_CSV_HEADERS.indexOf("Results");
    let total = 0;
    for (const row of rows) {
      total += Number(insightToManualCsvRow(objectiveLeadOneCostedPixelMatchesManual(row))[resIdx]) || 0;
    }
    expect(total).toBe(12);
  });
});
