import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026.csv",
);

/** Sep 2026 production API CSV: spend/LPV present, Result columns empty — uncosted results[] only. */
function productionEmptyResultColumnsShape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  const results = Number(row.results) || 0;
  const rt = String(row.result_type ?? "").toLowerCase();
  const actions: { action_type: string; value: string }[] = [];
  if (linkClicks > 0) actions.push({ action_type: "link_click", value: String(linkClicks) });
  if (lpv > 0) actions.push({ action_type: "landing_page_view", value: String(lpv) });
  if (results > 0 && rt.includes("website")) {
    actions.push({ action_type: "offsite_conversion.fb_pixel_lead", value: String(results) });
  }
  if (results === 0 && linkClicks > 0) {
    actions.push({ action_type: "lead", value: "1" });
    actions.push({ action_type: "onsite_conversion.lead_grouped", value: "1" });
  }

  const rawDay = String(row._raw?.Day ?? row.date_start ?? "2026-09-23");
  const isoDay =
    rawDay.includes("-") && rawDay.length === 10 ? rawDay : rawDay.split("-").reverse().join("-");

  return {
    campaign_name: row.campaign_name ?? "",
    adset_name: row.ad_set_name ?? "",
    date_start: isoDay,
    spend: String(row.spend ?? "0"),
    reach: row.reach ?? "100",
    impressions: row.impressions ?? "200",
    ctr: row.ctr ?? "0.03",
    cpc: row.cpc ?? "1.00",
    inline_link_clicks: String(linkClicks),
    frequency: row.frequency ?? "1.5",
    optimization_goal: "OUTCOME_LEADS" as const,
    actions,
    cost_per_action_type: [],
    cost_per_result: [],
    objective_results: [],
    cost_per_objective_result: [],
    results:
      results > 0
        ? [
            { indicator: "actions:lead", values: [{ value: String(results) }] },
            {
              indicator: "actions:offsite_conversion.fb_pixel_lead",
              values: [{ value: String(results) }],
            },
          ]
        : [{ indicator: "actions:lead", values: [{ value: "1" }] }],
  };
}

describe("Credit Firm zero Result columns API CSV (Sep 2026 production)", () => {
  it("fills website submission on lead days and stays blank on non-lead days", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    for (const row of rows) {
      const expected = Number(row.results) || 0;
      const insight = productionEmptyResultColumnsShape(row);
      const primary = manualExportPrimaryResult(insight);
      const got = primary ? parseFloat(primary.value) : 0;
      expect(got).toBe(expected);
    }
  });

  it("insightToManualCsvRow matches manual Result type on Sep 27 (3 leads, 12 link clicks)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const leadDay = rows.find((r) => Number(r.results) === 3);
    expect(leadDay).toBeTruthy();
    const csvRow = insightToManualCsvRow(productionEmptyResultColumnsShape(leadDay!));
    const rtIdx = META_CSV_HEADERS.indexOf("Result type");
    const resIdx = META_CSV_HEADERS.indexOf("Results");
    expect(csvRow[rtIdx]).toContain("website submission");
    expect(Number(csvRow[resIdx])).toBe(3);
  });
});
