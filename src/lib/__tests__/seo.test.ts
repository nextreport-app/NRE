import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEYWORDS,
  faqPageJsonLd,
  HOME_JSON_LD,
  howToJsonLd,
  pageMetadata,
  PRODUCT_FAQ_SCHEMA,
} from "@/lib/seo";

describe("seo", () => {
  it("includes all four platforms in default keywords", () => {
    const joined = DEFAULT_KEYWORDS.join(" ");
    expect(joined).toContain("tiktok");
    expect(joined).toContain("ga4");
  });

  it("builds page metadata with canonical, hreflang, and large twitter card", () => {
    const meta = pageMetadata({
      title: "Pricing",
      description: "Test description for pricing page metadata.",
      path: "/pricing",
    });
    expect(meta.alternates?.canonical).toBe("https://nextreport.in/pricing");
    expect(meta.twitter?.card).toBe("summary_large_image");
    expect(meta.openGraph?.locale).toBe("en_IN");
  });

  it("does not include fake aggregate ratings in software schema", () => {
    const graph = HOME_JSON_LD["@graph"] as Record<string, unknown>[];
    const software = graph.find((node) => node["@type"] === "SoftwareApplication");
    expect(software).toBeDefined();
    expect(software).not.toHaveProperty("aggregateRating");
  });

  it("builds FAQ and HowTo schema helpers", () => {
    const faq = faqPageJsonLd(PRODUCT_FAQ_SCHEMA.slice(0, 1));
    expect(faq.mainEntity).toHaveLength(1);
    const howTo = howToJsonLd("Test", "Desc", [{ name: "Step 1", text: "Do thing" }]);
    expect(howTo.step).toHaveLength(1);
  });
});
