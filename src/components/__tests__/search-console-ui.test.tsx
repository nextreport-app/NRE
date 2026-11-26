import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchConsoleTrend } from "../search-console-trend";
import { SearchConsoleTable } from "../search-console-dashboard";
import {
  searchCountry,
  searchDateRange,
  searchClickShare,
} from "@/lib/search-console/presentation";
import type { GscSnapshot } from "@/lib/search-console/model";
const row = { clicks: 3, impressions: 20, ctr: 0.15, position: 4 };
const data = {
  days: 7,
  currentPeriod: { startIso: "2026-11-01", endIso: "2026-11-07" },
  trend: [
    { ...row, name: "2026-11-01" },
    { ...row, clicks: 0, name: "2026-11-02" },
    { ...row, name: "2026-11-04" },
  ],
} as GscSnapshot;
describe("Search Console presentation", () => {
  it("formats readable date ranges across years without shifting days", () => {
    expect(
      searchDateRange({ startIso: "2026-10-25", endIso: "2026-11-23" }),
    ).toBe("Oct 25 – Nov 23, 2026");
    expect(
      searchDateRange({ startIso: "2025-12-25", endIso: "2026-01-23" }),
    ).toBe("Dec 25, 2025 – Jan 23, 2026");
  });
  it("maps Google's alpha-3 codes and keeps unknown regions readable", () => {
    expect(searchCountry("ind")).toEqual({ name: "India", region: "IN" });
    expect(searchCountry("BRA")).toEqual({ name: "Brazil", region: "BR" });
    expect(searchCountry("zzz")).toEqual({ name: "ZZZ", region: null });
  });
  it("uses site totals for click share and avoids dividing by zero", () => {
    expect(searchClickShare(3, 25)).toBe("12%");
    expect(searchClickShare(0, 25)).toBe("0%");
    expect(searchClickShare(0, 0)).toBe("—");
    const html = renderToStaticMarkup(
      <SearchConsoleTable
        title="Queries"
        description="Current period"
        kind="query"
        rows={[{ ...row, name: "example" }]}
        totalClicks={25}
      />,
    );
    expect(html).toContain("Share of site clicks");
    expect(html).toContain("12%");
    expect(html).toContain("clicks in listed rows");
    expect(html).toContain("impressions in listed rows");
  });
  it("renders local country flags, monochrome device icons and empty states", () => {
    const country = renderToStaticMarkup(
      <SearchConsoleTable
        title="Countries"
        description="Current"
        kind="country"
        rows={[{ ...row, name: "ind" }]}
        totalClicks={25}
      />,
    );
    expect(country).toContain("/country-flags.svg#IN");
    expect(country).toContain("India");
    const device = renderToStaticMarkup(
      <SearchConsoleTable
        title="Devices"
        description="Current"
        kind="device"
        rows={[{ ...row, name: "MOBILE" }]}
        totalClicks={25}
      />,
    );
    expect(device).toContain('stroke="currentColor"');
    expect(device).toContain("Mobile");
    const empty = renderToStaticMarkup(
      <SearchConsoleTable
        title="Pages"
        description="Current"
        kind="page"
        rows={[]}
        totalClicks={0}
      />,
    );
    expect(empty).toContain("No rows reported");
  });
  it("matches the shaded GA4 chart, preserves zero and separates missing-day segments", () => {
    const html = renderToStaticMarkup(<SearchConsoleTrend data={data} />);
    expect(html).toContain('aria-label="Nov 2: 0 clicks"');
    expect(html).not.toContain('aria-label="Nov 3:');
    expect(html.match(/stroke-linejoin="round"/g)).toHaveLength(2);
    expect(html.match(/role="button"/g)).toHaveLength(3);
    expect(html).toContain("linearGradient");
    expect(html).toContain("text-emerald-400");
    expect(html).toContain("Nov 7");
    expect(
      renderToStaticMarkup(
        <SearchConsoleTrend data={{ ...data, trend: [] }} />,
      ),
    ).toContain("No daily rows reported");
  });
});
