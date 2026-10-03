import { describe, expect, it } from "vitest";
import { buildMetaSyncDiagnostics } from "../meta-api-sync/sync-diagnostics";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";

describe("buildMetaSyncDiagnostics", () => {
  it("reports mapped sum and Meta field presence", () => {
    const rows = [
      {
        campaign_name: "DC Leads Campaign Main",
        adset_name: "Homebuyers - Broad Targeting",
        date_start: "2026-09-27",
        optimization_goal: "OUTCOME_LEADS",
        spend: "22.93",
        results: [
          { indicator: "actions:offsite_conversion.fb_pixel_lead", values: [{ value: "3" }] },
        ],
        actions: [
          { action_type: "link_click", value: "12" },
          { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
        ],
      },
    ];
    const d = buildMetaSyncDiagnostics(rows);
    expect(d.mappedResultsSum).toBe(3);
    expect(d.rowsWithResultsField).toBe(1);
    expect(manualExportPrimaryResult(rows[0])?.value).toBe("3");
  });
});
