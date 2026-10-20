import { describe, expect, it } from "vitest";
import {
  csvResultTypeMatchesDetection,
  summarizeCsvResultTypesForCampaign,
} from "../campaign-csv-result-type";
import type { MetricRow } from "../types";

function row(campaign: string, resultType: string): MetricRow {
  return {
    campaign_name: campaign,
    result_type: resultType,
    spend: 1,
    results: 1,
    _raw: {},
  };
}

describe("campaign-csv-result-type", () => {
  it("lists every distinct Result type per campaign", () => {
    const summary = summarizeCsvResultTypesForCampaign([
      row("A", "Leads (form)"),
      row("A", "Leads (form)"),
      row("A", "Website leads"),
    ]);
    expect(summary.distinct).toEqual(["Leads (form)", "Website leads"]);
    expect(summary.entries).toHaveLength(2);
  });

  it("matches detection when detected label equals any CSV-mapped objective", () => {
    const summary = summarizeCsvResultTypesForCampaign([
      row("A", "Leads (form)"),
      row("A", "Website leads"),
    ]);
    expect(csvResultTypeMatchesDetection(summary, "META FORM LEADS")).toBe(true);
    expect(csvResultTypeMatchesDetection(summary, "WEBSITE LEADS")).toBe(true);
    expect(csvResultTypeMatchesDetection(summary, "PURCHASES")).toBe(false);
  });
});
