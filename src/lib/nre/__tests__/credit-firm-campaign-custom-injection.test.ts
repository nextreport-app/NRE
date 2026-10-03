import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import {
  campaignCostedWebsiteIsCustomOnly,
  enrichAdSetInsightsFromCampaignLevel,
} from "../meta-api-sync/enrich-adset-from-campaign";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-manual-oct2026-bd25.csv",
);

const CUSTOM = "actions:offsite_conversion.custom.446052571654985";

/** Live af4c228: ad-set has uncosted noise; true days also have costed custom on ad-set; false days only on campaign. */
function liveAdsetShape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const lpv = Number(row.landing_page_views) || 0;

  insight.objective_results = [];
  insight.cost_per_objective_result = [];
  insight.cost_per_action_type = [];
  insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
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

function liveCampaignShape(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const manualResults = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  if (manualResults <= 0 && spend <= 0) return null;
  const count = manualResults > 0 ? manualResults : 1;
  return {
    campaign_name: String(row._raw?.["Campaign name"] ?? "DC Leads Campaign Main"),
    date_start: String(row._raw?.Day ?? ""),
    spend: String(spend),
    results: [{ indicator: CUSTOM, values: [{ value: String(count) }] }],
    cost_per_result: [{ indicator: CUSTOM, values: [{ value: String(spend / count) }] }],
  };
}

describe("Credit Firm campaign custom injection (live af4c228 / 16 mapped)", () => {
  it("flags campaign rows that are costed custom website only", () => {
    const row = liveCampaignShape(
      parseCsvText(readFileSync(MANUAL, "utf8")).rows.find((r) => String(r._raw?.Day) === "2026-09-10")!,
    )!;
    expect(campaignCostedWebsiteIsCustomOnly(row)).toBe(true);
  });

  it("maps 12 after blocking campaign-only custom on blank ad-set days", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const adsets = rows.map(liveAdsetShape);
    const campaigns = rows.map(liveCampaignShape).filter((r): r is NonNullable<typeof r> => r != null);
    const enriched = enrichAdSetInsightsFromCampaignLevel(adsets, campaigns);

    let manualSum = 0;
    let apiSum = 0;
    for (let i = 0; i < rows.length; i++) {
      const day = String(rows[i]._raw?.Day ?? "");
      if (day < "2026-09-03" || day > "2026-10-02") continue;
      const expected = Number(rows[i].results) || 0;
      manualSum += expected;
      const primary = manualExportPrimaryResult(enriched[i]);
      apiSum += primary ? parseFloat(primary.value) : 0;
      expect(primary ? parseFloat(primary.value) : 0, day).toBe(expected);
    }
    expect(manualSum).toBe(12);
    expect(apiSum).toBe(12);
  });
});
