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

/** Ad-set API noise (panel 1c41980): uncosted actions:lead daily + noisy actions[]. */
function adsetNoiseShape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;
  insight.cost_per_result = [];
  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
  insight.actions = [
    { action_type: "link_click", value: String(linkClicks || 1) },
    { action_type: "landing_page_view", value: String(lpv || 1) },
    { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
    { action_type: "onsite_web_lead", value: "1" },
  ];
  return insight;
}

function campaignCostedFromManual(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  if (manualResults <= 0 || spend <= 0) return null;
  return {
    campaign_name: String(row._raw?.["Campaign name"] ?? "DC Leads Campaign Main"),
    date_start: String(row._raw?.Day ?? ""),
    spend: String(spend),
    results: [{ indicator: "actions:lead", values: [{ value: String(manualResults) }] }],
    cost_per_result: [
      {
        indicator: "actions:lead",
        values: [{ value: String(spend / manualResults) }],
      },
    ],
  };
}

describe("Credit Firm campaign enrich (live 1c41980 panel)", () => {
  it("maps ~12 after merging campaign costed lead over ad-set noise", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const adsets = rows.map(adsetNoiseShape);
    const campaigns = rows
      .map(campaignCostedFromManual)
      .filter((r): r is NonNullable<typeof r> => r != null);

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

  it("does not map false positives on blank manual days (Sep 10, 14, 24, 29)", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const adsets = rows.map(adsetNoiseShape);
    const campaigns = rows
      .map(campaignCostedFromManual)
      .filter((r): r is NonNullable<typeof r> => r != null);
    const enriched = enrichAdSetInsightsFromCampaignLevel(adsets, campaigns);

    for (const blankDay of ["2026-09-10", "2026-09-14", "2026-09-24", "2026-09-29"]) {
      const idx = rows.findIndex((r) => String(r._raw?.Day) === blankDay);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(manualExportPrimaryResult(enriched[idx])).toBeNull();
    }
  });
});
