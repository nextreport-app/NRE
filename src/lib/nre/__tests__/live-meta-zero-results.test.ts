import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";
import { rowsToCsv } from "../rows-to-csv";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

/** Production Credit Firm: results[] without cost_per_result; lead days use website indicator or actions-only. */
function creditFirmLiveInsight(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const results = Number(row.results) || 0;
  const rt = String(row.result_type ?? "").toLowerCase();
  insight.cost_per_result = [];
  insight.cost_per_action_type = [];

  if (results > 0 && rt.includes("website")) {
    insight.results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(results) }],
      },
    ];
  } else if (results > 0) {
    insight.results = [{ indicator: "actions:lead", values: [{ value: String(results) }] }];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.actions = (insight.actions ?? []).filter(
      (a) =>
        a.action_type !== "offsite_conversion.fb_pixel_lead" &&
        a.action_type !== "lead" &&
        a.action_type !== "onsite_conversion.lead_grouped",
    );
  }
  return insight;
}

describe("live Meta shape (results[] without CPR)", () => {
  it("currently reproduces all-blank Results when CPR fields missing", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      manualSum += Number(row.results) || 0;
      const primary = manualExportPrimaryResult(creditFirmLiveInsight(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
    }
    expect(manualSum).toBeGreaterThan(0);
    // Documents production bug until fixed:
    expect(apiSum).toBe(manualSum);
  });

  it("insightToManualCsvRow fills website submission on lead days", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const leadRow = rows.find((r) => Number(r.results) > 0 && String(r.result_type).includes("website"));
    expect(leadRow).toBeTruthy();
    const csvRow = insightToManualCsvRow(creditFirmLiveInsight(leadRow!));
    const resultTypeIdx = META_CSV_HEADERS.indexOf("Result type");
    const resultsIdx = META_CSV_HEADERS.indexOf("Results");
    expect(csvRow[resultTypeIdx]).toContain("website submission");
    expect(Number(csvRow[resultsIdx])).toBeGreaterThan(0);
  });
});
