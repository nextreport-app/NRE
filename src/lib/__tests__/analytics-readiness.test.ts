import { describe, expect, it } from "vitest";
import { analyticsPageLocation, validGaMeasurementId } from "../analytics";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { JsonLd } from "@/components/json-ld";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
describe("SEO and analytics privacy readiness", () => {
  it("excludes private/auth/token URLs and user form parameters", () => {
    for (const path of [
      "/clients",
      "/login",
      "/reset-password",
      "/r/private-token",
      "/account",
      "/api/contact",
    ])
      expect(
        analyticsPageLocation(
          "https://nextreport.in",
          path,
          "?email=person@example.com",
        ),
      ).toBeNull();
    expect(
      analyticsPageLocation(
        "https://nextreport.in",
        "/pricing",
        "?email=person@example.com&token=secret&utm_source=google&utm_campaign=launch",
      ),
    ).toBe(
      "https://nextreport.in/pricing?utm_source=google&utm_campaign=launch",
    );
    expect(
      analyticsPageLocation(
        "https://nextreport.in",
        "/",
        "?utm_source=person@example.com&utm_campaign=9876543210",
      ),
    ).toBe("https://nextreport.in/");
  });
  it("validates GA IDs before putting them in script content", () => {
    expect(validGaMeasurementId("G-TEST123")).toBe(true);
    expect(validGaMeasurementId("G-X';alert(1)//")).toBe(false);
    expect(validGaMeasurementId("UA-1234")).toBe(false);
  });
  it("keeps script-closing content inert inside JSON-LD", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, {
        data: {
          "@context": "https://schema.org",
          name: "</script><script>alert(1)</script>",
        },
      }),
    );
    expect((html.match(/<script/g) ?? []).length).toBe(1);
    expect(html).toContain("\\u003c/script>");
  });
  it("publishes all three public guides without fake sitemap modification dates", () => {
    const entries = sitemap();
    for (const path of ["/help/download", "/help/metrics", "/help/objectives"])
      expect(
        entries.some((entry) => entry.url === `https://nextreport.in${path}`),
      ).toBe(true);
    expect(entries.every((entry) => !entry.lastModified)).toBe(true);
    expect(
      entries.some((entry) =>
        /\/clients|\/r\/|\/case-studies|\/login/.test(entry.url),
      ),
    ).toBe(false);
    expect(robots().sitemap).toBe("https://nextreport.in/sitemap.xml");
  });
});
