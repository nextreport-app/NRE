import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { enrichAdSetInsightsFromCampaignLevel } from "../meta-api-sync/enrich-adset-from-campaign";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026-upload.csv",
);

/** Deploy 77b7977: costed LPV at campaign level, website only via cost_per_action custom ≈ spend. */
function panel77b7977Adset(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  const customCount = manualResults > 0 ? manualResults : 1;

  insight.cost_per_result = [];
  insight.objective_results = [];
  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  insight.cost_per_action_type = [];
  if (manualResults > 0) {
    insight.results = [
      {
        indicator: "actions:offsite_conversion.custom.446052571654985",
        values: [{ value: String(manualResults) }],
      },
    ];
    insight.cost_per_result = [
      {
        indicator: "actions:offsite_conversion.custom.446052571654985",
        values: [{ value: String(spend / manualResults) }],
      },
    ];
  }

  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: String(customCount) },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
    { action_type: "onsite_web_lead", value: String(manualResults > 0 ? manualResults : 1) },
  ];
  return insight;
}

function campaignLpvOnly(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const lpv = Number(row.landing_page_views) || 1;
  const spend = Number(row.spend) || 0;
  return {
    campaign_name: String(row._raw?.["Campaign name"] ?? "DC Leads Campaign Main"),
    date_start: String(row._raw?.Day ?? ""),
    spend: String(spend),
    results: [{ indicator: "actions:landing_page_view", values: [{ value: String(lpv) }] }],
    cost_per_result: [
      { indicator: "actions:landing_page_view", values: [{ value: String(spend / lpv) }] },
    ],
  };
}

describe("panel 77b7977 (LPV campaign noise + custom CPA)", () => {
  it("maps manual website submissions after blocking LPV campaign merge", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const adsets = rows.map(panel77b7977Adset);
    const campaigns = rows.map(campaignLpvOnly);
    const enriched = enrichAdSetInsightsFromCampaignLevel(adsets, campaigns);

    let manualSum = 0;
    let apiSum = 0;
    for (let i = 0; i < rows.length; i++) {
      const day = String(rows[i]._raw?.Day ?? "");
      if (day < "2026-09-03") continue;
      const expected = Number(rows[i].results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(enriched[i]);
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, day).toBe(expected);
    }
    expect(manualSum).toBe(10);
    expect(apiSum).toBe(10);
  });
});
