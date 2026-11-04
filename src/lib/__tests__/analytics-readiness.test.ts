import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GTM_CONTAINER_ID, GTM_CONSENT_BOOT_SCRIPT, analyticsPageLocation, validGaMeasurementId } from "../analytics";
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
  it("initializes denied consent without loading a vendor or duplicating the queue", () => {
    const window: Record<string, unknown> = {};
    runInNewContext(GTM_CONSENT_BOOT_SCRIPT, { window });
    const queue = window.dataLayer as unknown[][];
    expect(queue).toHaveLength(1);
    expect(Array.from(queue[0]).slice(0, 2)).toEqual(["consent", "default"]);
    expect(queue[0][2]).toEqual({ analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    runInNewContext(GTM_CONSENT_BOOT_SCRIPT, { window });
    expect(window.dataLayer).toBe(queue);
    expect(GTM_CONTAINER_ID).toBe("GTM-PZPXTRPH");
  });
  it("replaces the direct GA loader with one consent-gated container", () => {
    const source = readFileSync("src/components/google-analytics.tsx", "utf8");
    expect(source).not.toContain("/gtag/js");
    expect(source).toContain('if (!allowed)');
    expect(source).toContain('document.getElementById("nre-google-tag-manager")');
    expect(source).toContain('event: "nre_public_page_view"');
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
