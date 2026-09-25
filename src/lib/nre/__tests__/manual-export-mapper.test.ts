import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const USER_CSV = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

describe("manual-export-mapper", () => {
  it("never fills Results from actions alone when Meta sends costed combined lead that mismatches pixel", () => {
    const primary = manualExportPrimaryResult({
      campaign_name: "DC Leads Campaign Main",
      optimization_goal: "OUTCOME_LEADS",
      results: [{ indicator: "actions:lead", values: [{ value: "2" }] }],
      cost_per_result: [{ indicator: "actions:lead", values: [{ value: "3.50" }] }],
      actions: [
        { action_type: "link_click", value: "9" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "1" },
        { action_type: "offsite_conversion.custom.999", value: "1" },
      ],
      cost_per_action_type: [{ action_type: "offsite_conversion.fb_pixel_lead", value: "12.00" }],
    });
    expect(primary).toBeNull();
  });

  it("Credit Firm manual fixture: API-shaped rows sum to same Results as manual CSV", () => {
    const { rows } = parseCsvText(readFileSync(USER_CSV, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      manualSum += Number(row.results) || 0;
      const insight = manualRowToMetaInsight(row);
      const primary = manualExportPrimaryResult(insight);
      apiSum += primary ? parseFloat(primary.value) : 0;
    }
    expect(apiSum).toBe(manualSum);
    expect(manualSum).toBe(12);
  });
});
