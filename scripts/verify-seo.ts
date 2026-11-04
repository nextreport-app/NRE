/** Run against a production build: SEO_BASE_URL=http://localhost:3100 npm run verify:seo */
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { PUBLIC_SITEMAP_ROUTES, SITE_URL } from "../src/lib/seo";

const origin = process.env.SEO_BASE_URL ?? SITE_URL;
const titles = new Set<string>();
const descriptions = new Set<string>();
const linkedPaths = new Set<string>();
const results: { path: string; status: string; detail?: string }[] = [];
async function check(path: string, work: () => Promise<void>) {
  try {
    await work();
    results.push({ path, status: "PASS" });
  } catch (error) {
    results.push({ path, status: "FAIL", detail: (error as Error).message });
  }
}
async function main() {
  await check("/robots.txt", async () => {
    const response = await fetch(`${origin}/robots.txt`);
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, new RegExp(`Sitemap: ${SITE_URL}/sitemap.xml`));
    assert(!/Disallow:\s*\/\s*$/m.test(text), "Public root blocked");
  });
  await check("/sitemap.xml", async () => {
    const response = await fetch(`${origin}/sitemap.xml`);
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(XMLValidator.validate(text), true);
    const entries = new XMLParser().parse(text).urlset.url;
    assert.deepEqual(
      entries.map((entry: { loc: string }) => entry.loc).sort(),
      PUBLIC_SITEMAP_ROUTES.map((route) => SITE_URL + route.path).sort(),
    );
    assert(
      entries.every((entry: { lastmod?: string }) => !entry.lastmod),
      "Do not invent lastmod from request/build time",
    );
  });
  for (const route of PUBLIC_SITEMAP_ROUTES)
    await check(route.path, async () => {
      const response = await fetch(origin + route.path, { redirect: "manual" });
      assert.equal(response.status, 200);
      assert(!/noindex/i.test(response.headers.get("x-robots-tag") ?? ""));
      const html = await response.text();
      assert.match(html, /<title>[^<]+<\/title>/);
      const title = html.match(/<title>([^<]+)<\/title>/)![1];
      const description = html.match(
        /<meta name="description" content="([^"]+)"/,
      )?.[1];
      assert(!titles.has(title), "Duplicate page title");
      titles.add(title);
      if (description) {
        assert(!descriptions.has(description), "Duplicate description");
        descriptions.add(description);
      }
      for (const anchor of html.matchAll(/<a\b[^>]*href="([^"]+)"/g)) {
        try {
          const url = new URL(anchor[1], origin);
          if ([new URL(origin).origin, SITE_URL].includes(url.origin))
            linkedPaths.add(url.pathname);
        } catch {
          /* Non-web anchor. */
        }
      }
      assert.match(html, /<meta name="description" content="[^"]+"/);
      assert(
        html.includes(`rel="canonical" href="${SITE_URL}${route.path}"`) ||
          (route.path === "/" &&
            html.includes(`rel="canonical" href="${SITE_URL}"`)),
        "Wrong canonical",
      );
      assert(!/<meta name="robots" content="[^"]*noindex/i.test(html));
      assert.equal(
        (html.match(/<h1(?:\s|>)/g) ?? []).length,
        1,
        "Expected one H1",
      );
      for (const script of html.matchAll(
        /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      )) {
        const schema = JSON.parse(script[1]);
        assert.equal(schema["@context"], "https://schema.org");
        const visibleText = html
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&#x27;|&#39;|&apos;/g, "'")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ");
        const nodes = schema["@graph"] ?? [schema];
        for (const node of nodes)
          if (node["@type"] === "FAQPage")
            for (const question of node.mainEntity)
              assert(
                visibleText.includes(question.name),
                `FAQ question absent from visible HTML: ${question.name}`,
              );
        assert(
          !JSON.stringify(schema).includes('"aggregateRating"'),
          "Unverified ratings",
        );
      }
    });
  await check("public internal links", async () => {
    for (const route of PUBLIC_SITEMAP_ROUTES)
      assert(
        linkedPaths.has(route.path),
        `Orphaned public route: ${route.path}`,
      );
  });
  await check("/opengraph-image", async () => {
    const response = await fetch(origin + "/opengraph-image", {
      redirect: "manual",
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^image\//);
  });
  await check("www canonical host", async () => {
    // Native Node fetch may replace Host; use an explicit HTTP request for this routing check.
    await new Promise<void>((resolve, reject) => {
      const target = new URL("/pricing", origin);
      const request = (
        target.protocol === "https:" ? httpsRequest : httpRequest
      )(
        target,
        { method: "HEAD", headers: { Host: "www.nextreport.in" } },
        (response) => {
          response.resume();
          try {
            assert.equal(response.statusCode, 308);
            assert.equal(
              response.headers.location,
              "https://nextreport.in/pricing",
            );
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      );
      request.on("error", reject);
      request.end();
    });
  });
  await check("/download", async () => {
    const response = await fetch(origin + "/download", { redirect: "manual" });
    assert.equal(response.status, 308);
    assert.match(response.headers.get("location") ?? "", /\/help\/download$/);
  });
  await check("/not-a-real-page-seo-check", async () => {
    assert.equal(
      (
        await fetch(origin + "/not-a-real-page-seo-check", {
          redirect: "manual",
        })
      ).status,
      404,
    );
  });
  await check("/case-studies", async () => {
    const text = await (await fetch(origin + "/case-studies")).text();
    assert.match(text, /<meta name="robots" content="[^"]*noindex/);
  });
  await check("private workspace guard", async () => {
    const response = await fetch(origin + "/clients", { redirect: "manual" });
    assert([302, 303, 307].includes(response.status));
    assert.match(response.headers.get("location") ?? "", /\/login(?:\?|$)/);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
  await check("missing shared report", async () => {
    const response = await fetch(origin + "/r/seoAudit00000", { redirect: "manual" });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  });
  console.table(results);
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
