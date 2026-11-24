import { describe, expect, it } from "vitest";
import { unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import config from "../../../next.config";
import robots from "@/app/robots";

describe("performance route migration", () => {
  it.each([
    ["/overview", "/performance/meta-ads"],
    ["/websites", "/performance/google-analytics"],
  ])("permanently redirects %s while preserving client and other query context", async (oldPath, newPath) => {
    const response = await unstable_getResponseFromNextConfig({url: `https://nextreport.in${oldPath}?client=express&range=30`, nextConfig: config});
    expect(response.status).toBe(308);
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe(newPath);
    expect(destination.searchParams.get("client")).toBe("express");
    expect(destination.searchParams.get("range")).toBe("30");
  });
  it.each(["/performance/meta-ads", "/performance/google-analytics"])("adds explicit noindex headers to %s", async path => {
    const response = await unstable_getResponseFromNextConfig({url: `https://nextreport.in${path}`, nextConfig: config});
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/performance"]));
  });
});
