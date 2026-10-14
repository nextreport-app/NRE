import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { mergeApiCsvWithManualReference } from "../meta-api-sync/merge-reference-manual-csv";
import { sumResultsColumnInCsv } from "../meta-api-sync/csv-results-sum";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-manual-oct2026-bd25.csv",
);
const API_OUT = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-api-sync-oct2026-cae0.csv",
);

const CUSTOM = "offsite_conversion.custom.446052571654985";
const CUSTOM_IND = `actions:${CUSTOM}`;

/** Live aee404a: costed custom in results on 12 days; only 8 match manual (4 false +8 true). */
function liveOvercountInsight(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const apiResults = Number(
    parseCsvText(readFileSync(API_OUT, "utf8")).rows.find(
      (r) => String(r._raw?.Day) === String(row._raw?.Day),
    )?.results ?? 0,
  );
  const count = apiResults > 0 ? apiResults : 0;
  if (count <= 0) {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.cost_per_result = [];
    return insight;
  }

  const spend = Number(row.spend) || 0;
  insight.results = [{ indicator: CUSTOM_IND, values: [{ value: String(count) }] }];
  insight.cost_per_result = [{ indicator: CUSTOM_IND, values: [{ value: String(spend / count) }] }];
  insight.objective_results = [];
  insight.cost_per_action_type = [];

  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
    { action_type: "onsite_web_lead", value: String(count >= 2 ? count : 1) },
  ];

  // Manual lead days: custom appears in actions[]; API-only false positives do not.
  if (manualResults > 0) {
    insight.actions.push({ action_type: CUSTOM, value: String(count) });
  }

  return insight;
}

describe("Credit Firm cae0 over-count (16 API vs 12 manual)", () => {
  it("drops costed custom in results[] when custom is missing from actions[] (Sep 10 pattern)", () => {
    const row = liveOvercountInsight(
      parseCsvText(readFileSync(MANUAL, "utf8")).rows.find(
        (r) => String(r._raw?.Day) === "2026-09-10",
      )!,
    );
    expect(manualExportPrimaryResult(row)).toBeNull();
  });

  it("mapper yields 12 when costed custom is corroborated in actions[]", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      const day = String(row._raw?.Day ?? "");
      if (day < "2026-09-03" || day > "2026-10-02") continue;
      const expected = Number(row.results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(liveOvercountInsight(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, day).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });

  it("hybrid merge fixes shipped API CSV against manual reference", () => {
    const manualText = readFileSync(MANUAL, "utf8");
    const apiText = readFileSync(API_OUT, "utf8");
    expect(sumResultsColumnInCsv(apiText)).toBe(16);
    const merged = mergeApiCsvWithManualReference(apiText, manualText);
    expect(sumResultsColumnInCsv(merged)).toBe(12);
  });
});
