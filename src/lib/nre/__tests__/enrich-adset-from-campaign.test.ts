import { describe, expect, it } from "vitest";
import { enrichAdSetInsightsFromCampaignLevel } from "../meta-api-sync/enrich-adset-from-campaign";
import type { MetaInsightRow } from "@/lib/meta-api";

describe("enrichAdSetInsightsFromCampaignLevel", () => {
  it("copies results[] from campaign when ad set row has delivery only", () => {
    const adset: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      adset_name: "Homebuyers - Broad Targeting",
      date_start: "2026-09-27",
      spend: "22.93",
      actions: [{ action_type: "landing_page_view", value: "10" }],
    };
    const campaign: MetaInsightRow = {
      campaign_name: "DC Leads Campaign Main",
      date_start: "2026-09-27",
      spend: "22.93",
      results: [
        { indicator: "actions:lead", values: [{ value: "3" }] },
      ],
      cost_per_result: [
        { indicator: "actions:lead", values: [{ value: "7.64" }] },
      ],
    };
    const [out] = enrichAdSetInsightsFromCampaignLevel([adset], [campaign]);
    expect(out.results?.[0]?.indicator).toBe("actions:lead");
    expect(out.cost_per_result?.length).toBe(1);
  });

  it("does not copy when two ad sets share campaign+day", () => {
    const adsetA: MetaInsightRow = {
      campaign_name: "C",
      adset_name: "A",
      date_start: "2026-09-01",
      spend: "1",
    };
    const adsetB: MetaInsightRow = {
      campaign_name: "C",
      adset_name: "B",
      date_start: "2026-09-01",
      spend: "2",
    };
    const campaign: MetaInsightRow = {
      campaign_name: "C",
      date_start: "2026-09-01",
      results: [{ indicator: "actions:lead", values: [{ value: "5" }] }],
      cost_per_result: [{ indicator: "actions:lead", values: [{ value: "1" }] }],
    };
    const out = enrichAdSetInsightsFromCampaignLevel([adsetA, adsetB], [campaign]);
    expect(out[0].results).toBeUndefined();
    expect(out[1].results).toBeUndefined();
  });
});
