import { describe, it, expect } from "vitest";
import { detectCampaignObjectives, detectGoogleObjectiveKey, detectMetaObjectiveKey } from "../detect-objective";
import type { MetricRow } from "../types";

describe("detectMetaObjectiveKey", () => {
  // Returns "leads", not "website_leads" — meta-dictionary.ts's own
  // website_leads/cost_per_lead entries are tagged `objectives: ["leads"]`,
  // so that's the key that actually needs to come out of here for
  // selectMetrics to pick them up (see detectMetaObjectiveKey's own doc
  // comment on this).
  it("classifies a website-leads CSV as 'leads'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "website leads", "cost per lead"])).toBe("leads");
  });

  it("classifies a video-views CSV as 'video_views'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "thruplays", "video plays"])).toBe("video_views");
  });

  it("classifies an engagement CSV as 'engagement'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "post engagements", "page engagement"])).toBe("engagement");
  });

  it("classifies an app-installs CSV as 'app_promotion'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "app installs", "cost per app install"])).toBe("app_promotion");
  });

  it("classifies a purchases/ROAS CSV as 'sales'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "results roas", "results value"])).toBe("sales");
  });

  it("classifies a messaging-conversations CSV as 'messaging'", () => {
    expect(detectMetaObjectiveKey(["campaign name", "messaging conversations started"])).toBe("messaging");
  });

  it("prefers the majorityResultLabel signal over columns when both are given", () => {
    expect(detectMetaObjectiveKey(["campaign name", "link clicks"], "WEBSITE LEADS")).toBe("leads");
  });

  it("falls back to 'traffic' when nothing distinctive is present", () => {
    expect(detectMetaObjectiveKey(["campaign name", "reach", "impressions"])).toBe("traffic");
  });

  it("classifies LINK CLICKS and LANDING PAGE VIEWS result labels as 'traffic' (Fix 6)", () => {
    expect(detectMetaObjectiveKey(["campaign name"], "LINK CLICKS")).toBe("traffic");
    expect(detectMetaObjectiveKey(["campaign name"], "LANDING PAGE VIEWS")).toBe("traffic");
  });
});

describe("detectCampaignObjectives — per-campaign detection for mixed-objective accounts (Fix 6)", () => {
  function row(campaign: string, resultType: string, results = 1): MetricRow {
    return { campaign_name: campaign, result_type: resultType, results, spend: 10, reach: 100 };
  }

  it("returns the union of every campaign's own objective, not one account-wide guess", () => {
    const rows: MetricRow[] = [
      row("Reach Campaign", "Reach"),
      row("Reach Campaign", "Reach"),
      row("Leads Campaign", "Website lead"),
      row("Traffic Campaign", "Link click"),
    ];
    const objectives = detectCampaignObjectives(rows, ["campaign name", "result type"]);
    expect(objectives).toContain("reach");
    expect(objectives).toContain("leads");
    expect(objectives).toContain("traffic");
  });

  it("dedupes when multiple campaigns share the same objective", () => {
    const rows: MetricRow[] = [row("A", "Reach"), row("B", "Reach")];
    const objectives = detectCampaignObjectives(rows, ["campaign name"]);
    expect(objectives).toEqual(["reach"]);
  });

  it("groups rows by campaign_name before classifying, not row-by-row", () => {
    // A single campaign's rows must be classified TOGETHER (majority result
    // type across all its rows), not as 3 separate single-row campaigns.
    const rows: MetricRow[] = [row("Leads Campaign", "Website lead", 5), row("Leads Campaign", "Website lead", 3)];
    const objectives = detectCampaignObjectives(rows, ["campaign name"]);
    expect(objectives).toEqual(["leads"]);
  });

  it("regression: a real per-campaign signal (LINK CLICKS) is never overridden by another campaign's unrelated header presence", () => {
    // Caught empirically: header-presence fallback checks used to be
    // interleaved with label checks inside detectMetaObjectiveKey, so a
    // Traffic campaign's own unambiguous "Link click" result_type was
    // getting overridden to "leads" purely because the SAME shared CSV
    // also had a "Website leads" column from an unrelated Lead Gen
    // campaign. A specific per-campaign signal must always win.
    const rows: MetricRow[] = [
      row("Traffic Campaign", "Link click", 60),
      row("Leads Campaign", "Website lead", 5),
    ];
    const headers = ["campaign name", "result type", "website leads", "cost per lead", "link clicks"];
    const objectives = detectCampaignObjectives(rows, headers);
    expect(objectives).toContain("traffic");
    expect(objectives).toContain("leads");
  });

  it("classifies a blank-result_type campaign with zero results and real reach as 'reach' (a real Reach campaign's typical shape)", () => {
    const reachRow: MetricRow = { campaign_name: "Reach Campaign", result_type: "", results: 0, spend: 10, reach: 5000 };
    const objectives = detectCampaignObjectives([reachRow, reachRow], ["campaign name"]);
    expect(objectives).toEqual(["reach"]);
  });
});

describe("detectGoogleObjectiveKey", () => {
  it("classifies a shopping/Performance Max CSV as 'shopping'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "orders", "conv. value / cost"])).toBe("shopping");
  });

  it("classifies a video/YouTube CSV as 'video'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "trueview views", "trueview avg. cpv"])).toBe("video");
  });

  it("classifies a Demand Gen engagement CSV as 'demand_gen'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "engagements", "engagement rate"])).toBe("demand_gen");
  });

  it("classifies a Display viewability CSV as 'display'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "viewable impr.", "viewable rate"])).toBe("display");
  });

  it("classifies a store-visits CSV as 'local'", () => {
    expect(detectGoogleObjectiveKey(["campaign", "store visits"])).toBe("local");
  });

  it("defaults to 'search' for a plain Search Ads CSV", () => {
    expect(detectGoogleObjectiveKey(["campaign", "cost", "clicks", "impr.", "avg. cpc"])).toBe("search");
  });
});
