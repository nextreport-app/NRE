import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { manualExportPrimaryResult } from "../meta-api-sync/manual-export-mapper";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026.csv",
);

/**
 * Production bug (79 total): Meta sends cost_per_action_type for pixel on many days
 * without a costed primary result in results[] — must not count as website leads.
 */
function metaWithCostedPixelEveryDay(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const spend = Number(row.spend) || 0;
  const linkClicks = Number(row.link_clicks) || 0;
  const manualResults = Number(row.results) || 0;
  const inflatedCount = manualResults > 0 ? manualResults * 2 : Math.max(1, Math.min(linkClicks, 7));

  insight.results = [{ indicator: "actions:lead", values: [{ value: String(inflatedCount) }] }];
  insight.cost_per_result = [];
  insight.cost_per_action_type = [
    {
      action_type: "offsite_conversion.fb_pixel_lead",
      value: String(spend > 0 && inflatedCount > 0 ? spend / inflatedCount : 0),
    },
  ];
  insight.actions = [
    ...(insight.actions ?? []).filter((a) => a.action_type !== "offsite_conversion.fb_pixel_lead"),
    { action_type: "offsite_conversion.fb_pixel_lead", value: String(inflatedCount) },
  ];
  return insight;
}

describe("Credit Firm 79-lead inflation (costed pixel without costed results[])", () => {
  it("does not count website leads from cost_per_action_type alone", () => {
    const { rows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    let manualSum = 0;
    let apiSum = 0;
    for (const row of rows) {
      manualSum += Number(row.results) || 0;
      const primary = manualExportPrimaryResult(metaWithCostedPixelEveryDay(row));
      apiSum += primary ? parseFloat(primary.value) : 0;
    }
    expect(apiSum).toBe(0);
    expect(manualSum).toBeGreaterThan(0);
  });
});
