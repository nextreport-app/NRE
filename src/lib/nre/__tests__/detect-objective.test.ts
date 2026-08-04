import { describe, it, expect } from "vitest";
import { detectGoogleObjectiveKey, detectMetaObjectiveKey } from "../detect-objective";

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
