import { describe, expect, it } from "vitest";
import { buildCreativeReportSections } from "../creative-report-data";
import type { NreRow } from "../columns";

function adRow(overrides: Partial<Record<string, string>> & { campaign: string; ad: string; day: string }): NreRow {
  return {
    campaign_name: overrides.campaign,
    ad_set_name: "Ad Set 1",
    day: overrides.day,
    spend: overrides.spend ?? "100",
    results: overrides.results ?? "5",
    impressions: overrides.impressions ?? "1000",
    ctr: overrides.ctr ?? "2",
    frequency: overrides.frequency ?? "1.5",
    _raw: {
      "Campaign name": overrides.campaign,
      "Ad set name": "Ad Set 1",
      "Ad name": overrides.ad,
      Day: overrides.day,
      "Amount spent": overrides.spend ?? "100",
      Results: overrides.results ?? "5",
      Impressions: overrides.impressions ?? "1000",
      "CTR (all)": overrides.ctr ?? "2",
      Frequency: overrides.frequency ?? "1.5",
    },
  };
}

describe("buildCreativeReportSections", () => {
  it("groups ads by campaign and assigns status badges", () => {
    const rows: NreRow[] = [
      adRow({ campaign: "Camp A", ad: "Video Winner", day: "08-01-2026", spend: "200", ctr: "3", results: "10" }),
      adRow({ campaign: "Camp A", ad: "Image Slow", day: "08-01-2026", spend: "50", ctr: "0.5", results: "1", frequency: "3.5" }),
    ];

    const result = buildCreativeReportSections({
      rawRows: rows,
      adNameColumn: "Ad name",
      currencySymbol: "$",
      dateRangeLine: "Aug 1 - Aug 1",
      keptCampaignNames: new Set(["Camp A"]),
    });

    expect(result.overviewSlides).toHaveLength(1);
    expect(result.overviewSlides[0].ads).toHaveLength(2);
    expect(result.topSlides).toHaveLength(1);
    expect(result.fatigueSlide).not.toBeNull();
    expect(result.fatigueSlide!.ads.some((a) => a.adName === "Image Slow")).toBe(true);
  });

  it("returns empty sections when no ad names present", () => {
    const rows: NreRow[] = [
      {
        campaign_name: "Camp A",
        ad_set_name: "Ad Set 1",
        spend: "100",
        _raw: { "Campaign name": "Camp A" },
      },
    ];
    const result = buildCreativeReportSections({
      rawRows: rows,
      adNameColumn: "Ad name",
      currencySymbol: "$",
      dateRangeLine: "Aug 1",
      keptCampaignNames: new Set(["Camp A"]),
    });
    expect(result.overviewSlides).toHaveLength(0);
  });
});
