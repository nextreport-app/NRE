import { describe, expect, it } from "vitest";
import { metaCsvExportResultValue } from "../meta-csv-export-counting";
import type { MetricRow } from "../types";

function row(partial: Partial<MetricRow>): MetricRow {
  return {
    campaign_name: "C1",
    ad_set_name: "A1",
    spend: 0,
    impressions: 0,
    ...partial,
  } as MetricRow;
}

describe("metaCsvExportResultValue — WEBSITE LEADS", () => {
  it("uses Results when Result type is website leads", () => {
    expect(
      metaCsvExportResultValue(
        row({ result_type: "Website leads", results: 2, website_leads: 2 }),
        "WEBSITE LEADS",
      ),
    ).toBe(2);
  });

  it("ignores orphan website_leads without Result type", () => {
    expect(metaCsvExportResultValue(row({ result_type: "", results: 0, website_leads: 1 }), "WEBSITE LEADS")).toBe(0);
  });
});
