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

  it("surfaces Result indicator from _raw when result_type is blank", () => {
    const summary = summarizeCsvResultTypesForCampaign(
      [
        {
          campaign_name: "Unstoppable365_Website_Leads",
          _raw: { "Result indicator": "actions:offsite_conversion.custom.888777666" },
        },
      ],
      { "888777666": "CONVERSIONS:SCHEDULE_WEBSITE" },
    );
    expect(summary.primary).toBe("Website appointments scheduled");
    expect(summary.expectedResultLabel).toBe("WEBSITE SCHEDULE");
  });

  it("maps Campaigns-table Result indicator custom conversions to WEBSITE LEADS", () => {
    const summary = summarizeCsvResultTypesForCampaign([
      row("DC", "actions:offsite_conversion.custom.446052571654985"),
    ]);
    expect(summary.primary).toBe("website submission (custom conversion)");
    expect(summary.expectedResultLabel).toBe("WEBSITE LEADS");
    expect(csvResultTypeMatchesDetection(summary, "WEBSITE LEADS")).toBe(true);
    expect(summary.entries[0]?.resultType).toBe("website submission (custom conversion)");
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
