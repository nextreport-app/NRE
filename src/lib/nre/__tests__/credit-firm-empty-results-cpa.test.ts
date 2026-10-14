import { describe, expect, it } from "vitest";
import { enrichAdSetInsightsFromCampaignLevel } from "../meta-api-sync/enrich-adset-from-campaign";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import type { MetaInsightRow } from "@/lib/meta-api";

/** Live 66c7ee9: ad-set omits results[]; campaign custom merge blocked; CPA on fb_pixel_custom fired. */
describe("Credit Firm empty ad-set results[] CPA false positive", () => {
  it("does not map website submission from fb_pixel_custom CPA when results[] is empty", () => {
    const adset: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-10",
      optimization_goal: "OUTCOME_LEADS",
      spend: "14.12",
      actions: [
        { action_type: "link_click", value: "5" },
        { action_type: "landing_page_view", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
        { action_type: "onsite_web_lead", value: "1" },
      ],
      cost_per_action_type: [
        { action_type: "offsite_conversion.fb_pixel_custom", value: "14.12" },
      ],
    };
    const campaign: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      date_start: "2026-09-10",
      spend: "14.12",
      results: [
        {
          indicator: "actions:offsite_conversion.custom.446052571654985",
          values: [{ value: "1" }],
        },
      ],
      cost_per_result: [
        {
          indicator: "actions:offsite_conversion.custom.446052571654985",
          values: [{ value: "14.12" }],
        },
      ],
    };
    const [enriched] = enrichAdSetInsightsFromCampaignLevel([adset], [campaign]);
    expect(enriched.results?.length ?? 0).toBe(0);
    expect(manualExportPrimaryResult(enriched)).toBeNull();
  });

  it("does not map when custom appears in actions without costed custom in results[]", () => {
    const row: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-14",
      optimization_goal: "OUTCOME_LEADS",
      spend: "16.69",
      results: [{ indicator: "actions:lead", values: [{ value: "1" }] }],
      actions: [
        { action_type: "link_click", value: "5" },
        { action_type: "offsite_conversion.custom.446052571654985", value: "1" },
        { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
      ],
      cost_per_action_type: [
        { action_type: "offsite_conversion.fb_pixel_custom", value: "16.69" },
      ],
    };
    expect(manualExportPrimaryResult(row)).toBeNull();
  });
});
