import { describe, expect, it } from "vitest";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import type { MetaInsightRow } from "@/lib/meta-api";

/** Live 32cdcbc: 8 rows with meaningful conversion fields, actions pixel=1, results count higher. */
describe("costed website in results[] (actions count mismatch)", () => {
  it("maps Results from paired cost_per_result, not actions[]", () => {
    const row: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-27",
      optimization_goal: "OUTCOME_LEADS",
      spend: "22.93",
      results: [
        {
          indicator: "actions:offsite_conversion.fb_pixel_lead",
          values: [{ value: "3" }],
        },
      ],
      cost_per_result: [
        {
          indicator: "actions:offsite_conversion.fb_pixel_lead",
          values: [{ value: "7.64" }],
        },
      ],
      actions: [
        { action_type: "link_click", value: "12" },
        { action_type: "landing_page_view", value: "10" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        { action_type: "onsite_web_lead", value: "1" },
      ],
    };
    const primary = manualExportPrimaryResult(row);
    expect(primary?.value).toBe("3");
    expect(primary?.csvResultType).toBe("website submission");
  });

  it("maps costed actions:lead when no website breakdown", () => {
    const row: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-03",
      optimization_goal: "OUTCOME_LEADS",
      spend: "11.58",
      results: [{ indicator: "actions:lead", values: [{ value: "1" }] }],
      cost_per_result: [{ indicator: "actions:lead", values: [{ value: "11.58" }] }],
      actions: [
        { action_type: "link_click", value: "7" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        { action_type: "onsite_web_lead", value: "1" },
      ],
    };
    expect(manualExportPrimaryResult(row)?.value).toBe("1");
  });
});
