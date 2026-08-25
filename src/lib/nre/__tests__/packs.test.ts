import { describe, expect, it } from "vitest";
import { LEADS_META_FORM_PACK, METRIC_PACKS, packForResultLabel } from "../packs";
import { defaultMetaSelection } from "../available-metrics";

describe("METRIC_PACKS", () => {
  it("every pack is exactly 8 unique keys, always starting spend/reach/impressions + ctr in slot 6", () => {
    for (const pack of METRIC_PACKS) {
      expect(pack.keys).toHaveLength(8);
      expect(new Set(pack.keys).size).toBe(8);
      expect(pack.keys.slice(0, 3)).toEqual(["spend", "reach", "impressions"]);
      expect(pack.keys[5]).toBe("ctr");
    }
  });

  it("Instant Form pack matches the locked product 8 and defaultMetaSelection slot 7/8", () => {
    expect(LEADS_META_FORM_PACK.keys).toEqual([
      "spend",
      "reach",
      "impressions",
      "meta_form_leads",
      "cost_per_lead",
      "ctr",
      "link_clicks",
      "cpc_link_click",
    ]);
    expect(packForResultLabel("META FORM LEADS")?.id).toBe("leads_meta_form");
    const headers = [
      "Campaign name",
      "Amount spent",
      "Reach",
      "Impressions",
      "Results",
      "Cost per lead",
      "CTR (All)",
      "Link clicks",
      "CPC (cost per link click)",
    ];
    expect(defaultMetaSelection("META FORM LEADS", "COST PER LEAD", headers).map((m) => m.key)).toEqual(
      LEADS_META_FORM_PACK.keys,
    );
  });

  it("Reach pack is frequency/CPM/CPC (all)/cost-per-1k — LPV is not in the default 8", () => {
    const pack = packForResultLabel("REACH");
    expect(pack?.id).toBe("awareness_reach");
    expect(pack?.keys).toEqual([
      "spend",
      "reach",
      "impressions",
      "frequency",
      "cpm",
      "ctr",
      "cpc_all",
      "cost_per_1k_reached",
    ]);
    expect(pack?.keys).not.toContain("landing_page_views");
    expect(pack?.keys).not.toContain("cost_per_lpv");
    expect(packForResultLabel("UNIQUE REACH")?.keys).toEqual(pack?.keys);
  });
});
