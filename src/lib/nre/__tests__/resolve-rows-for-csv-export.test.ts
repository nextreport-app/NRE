import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { enrichAdSetInsightsFromCampaignLevel } from "../meta-api-sync/enrich-adset-from-campaign";
import { resolveMetaInsightRowsForCsvExport } from "../meta-api-sync/resolve-rows-for-csv-export";
import { buildMetaSyncDiagnostics } from "../meta-api-sync/sync-diagnostics";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-manual-oct2026-bd25.csv",
);

const CUSTOM = "actions:offsite_conversion.custom.446052571654985";

function liveAdsetOnly(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  insight.results = [];
  insight.cost_per_result = [];
  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "onsite_web_lead", value: "1" },
  ];
  if (manualResults > 0 && spend > 0) {
    insight.results = [{ indicator: CUSTOM, values: [{ value: String(manualResults) }] }];
    insight.cost_per_result = [
      { indicator: CUSTOM, values: [{ value: String(spend / manualResults) }] },
    ];
    insight.actions.push({
      action_type: "offsite_conversion.custom.446052571654985",
      value: String(manualResults),
    });
  }
  return insight;
}

function liveCampaign(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const count = manualResults > 0 ? manualResults : 1;
  return {
    campaign_name: String(row._raw?.["Campaign name"] ?? "DC Leads Campaign Main"),
    date_start: String(row._raw?.Day ?? ""),
    spend: String(spend),
    results: [{ indicator: CUSTOM, values: [{ value: String(count) }] }],
    cost_per_result: [{ indicator: CUSTOM, values: [{ value: String(spend / count) }] }],
  };
}

describe("resolveMetaInsightRowsForCsvExport (Credit Firm ecae86a panel)", () => {
  it("uses ad-set rows when costed website exists — mapped 12 not enriched 16", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const adsets = rows.map(liveAdsetOnly);
    const campaigns = rows.map(liveCampaign);
    const enriched = enrichAdSetInsightsFromCampaignLevel(adsets, campaigns);

    const forCsv = resolveMetaInsightRowsForCsvExport(adsets, enriched, true);
    expect(forCsv).toBe(adsets);

    let manualSum = 0;
    let apiSum = 0;
    for (let i = 0; i < rows.length; i++) {
      const day = String(rows[i]._raw?.Day ?? "");
      if (day < "2026-09-03" || day > "2026-10-02") continue;
      const expected = Number(rows[i].results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(forCsv[i]);
      apiSum += primary ? parseFloat(primary.value) : 0;
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
    expect(buildMetaSyncDiagnostics(enriched).mappedResultsSum).toBeGreaterThanOrEqual(12);
  });
});
