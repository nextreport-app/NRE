import { describe, expect, it } from "vitest";
import { filterBetaLinks, FOOTER_PRODUCT_LINKS } from "@/lib/site-links";

describe("site-links", () => {
  it("filters pricing during beta", () => {
    const visible = filterBetaLinks(FOOTER_PRODUCT_LINKS, true);
    expect(visible.some((l) => l.href === "/pricing")).toBe(false);
    expect(visible.some((l) => l.href === "/how-it-works")).toBe(true);
  });
});
