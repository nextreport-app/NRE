import { describe, expect, it } from "vitest";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import type { MetaInsightRow } from "@/lib/meta-api";

describe("costed offsite_conversion.custom in results[]", () => {
  it("maps website submission from paired cost_per_result", () => {
    const row: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-27",
      optimization_goal: "OUTCOME_LEADS",
      spend: "22.93",
      results: [
        {
          indicator: "actions:offsite_conversion.custom.446052571654985",
          values: [{ value: "3" }],
        },
      ],
      cost_per_result: [
        {
          indicator: "actions:offsite_conversion.custom.446052571654985",
          values: [{ value: "7.64" }],
        },
      ],
      actions: [
        { action_type: "link_click", value: "12" },
        { action_type: "landing_page_view", value: "10" },
        { action_type: "offsite_conversion.fb_pixel_custom", value: "1" },
        {
          action_type: "offsite_conversion.custom.446052571654985",
          value: "3",
        },
      ],
    };
    const primary = manualExportPrimaryResult(row);
    expect(primary?.value).toBe("3");
    expect(primary?.csvResultType).toBe("website submission");
  });
});
