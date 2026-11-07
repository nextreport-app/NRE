import { describe, expect, it } from "vitest";
import { homeCopy } from "../home-i18n";
import { marketingCopy } from "../marketing-i18n";
import { SITE_LOCALES } from "../site-theme";
import { PRICING_FAQS } from "../pricing-faq";
import { META_V1_PROMISE_BULLETS } from "../product-positioning";
import { LAUNCHING_SOON_PLATFORMS_LABEL } from "../meta-launch-scope";
import { META_ADS_SCOPES } from "../meta-api";
describe("Meta API public launch claims", () => {
  it.each(SITE_LOCALES)("keeps live API and deferred platforms accurate for $id", ({id}) => {
    const home = homeCopy(id);
    expect(marketingCopy(id).heroSubtext).toMatch(/API sync/);
    expect(home.howItWorksSteps[0].description).toMatch(/sync/);
    expect(home.features[0].description).toMatch(/API sync/);
    expect(home.pricing.plans.starter.features.join(" ")).toMatch(/API sync.*live/);
    expect(home.pricingComparison.metaReporting).toContain("API sync");
    expect(home.pricingComparison.otherPlatforms).not.toContain("Meta");
  });
  it("advertises only Meta as live and retains read-only permission scope", () => {
    expect(PRICING_FAQS[0].a).toContain("included in every plan");
    expect(PRICING_FAQS.map(item=>item.a).join(" ")).not.toMatch(/Meta.*launching soon/);
    expect(META_V1_PROMISE_BULLETS[1]).toContain("Google Ads, TikTok Ads and GA4");
    expect(LAUNCHING_SOON_PLATFORMS_LABEL).not.toContain("Meta");
    expect(META_ADS_SCOPES).toEqual(["ads_read"]);
  });
});
