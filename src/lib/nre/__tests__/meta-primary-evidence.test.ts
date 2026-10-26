import { describe, expect, it } from "vitest";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import type { MetaInsightRow } from "../../meta-api";

function combinedLead(spend: string, count: string, cost: string): MetaInsightRow {
  return {
    campaign_name: "Website leads campaign", optimization_goal: "OUTCOME_LEADS", spend,
    results: [{ indicator: "actions:lead", values: [{ value: count }] }],
    cost_per_result: [{ indicator: "actions:lead", values: [{ value: cost }] }],
    actions: [{ action_type: "link_click", value: "200" }],
  };
}

describe("Meta primary result evidence", () => {
  it("rejects a generic costed lead that cannot account for this row's spend", () => {
    expect(manualExportPrimaryResult(combinedLead("18", "2", "4"))).toBeNull();
  });
  it("keeps an internally consistent existing generic-lead shape", () => {
    expect(manualExportPrimaryResult(combinedLead("18", "2", "9"))?.value).toBe("2");
  });
  it("allows normal two-decimal cost rounding on larger counts", () => {
    expect(manualExportPrimaryResult(combinedLead("33.33", "100", "0.33"))?.value).toBe("100");
  });
  it("does not infer a website submission from generic custom-event CPA", () => {
    expect(manualExportPrimaryResult({ campaign_name: "Website leads campaign", optimization_goal: "OUTCOME_LEADS", spend: "18", actions: [{ action_type: "offsite_conversion.fb_pixel_custom", value: "1" }], cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_custom", value: "18" }] })).toBeNull();
  });
});
