import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MetaPerformanceDashboard } from "../meta-performance-dashboard";
import type { OverviewRow } from "@/lib/agency-overview";
import type { CampaignPerformance } from "@/lib/performance-monitor/facts";
const metrics = { spend: 100, impressions: 10000, clicks: 200, cpc: 0.5, ctr: 2, results: 10, cpr: 10 };
const campaign = (id: string): CampaignPerformance => ({ id, name: `Campaign ${id}`, objective: "WEBSITE LEADS", costLabel: "Cost per website lead", current: metrics, previous: metrics, comparableResults: true, signals: [] });
function markup(campaigns: CampaignPerformance[]) {
  const client = { id: "account", currency: "USD", timezone: "UTC", performanceFresh: true, budgetFresh: false, performance: { facts: { campaigns, periodA: { startIso: "2026-11-17", endIso: "2026-11-23" }, periodB: { startIso: "2026-11-10", endIso: "2026-11-16" }, current: { ...metrics, spend: 300 }, previous: metrics, empty: false } } } as OverviewRow;
  return renderToStaticMarkup(<MetaPerformanceDashboard client={client} />);
}
describe("account totals default disclosure", () => {
  it.each([0, 1, 2, 10])("uses the reported campaign count (%s)", count => {
    const html = markup(Array.from({ length: count }, (_, i) => campaign(String(i))));
    const tag = html.match(/<details[^>]*aria-label="Account metrics"[^>]*>/)?.[0];
    expect(tag).toBeDefined();
    expect(tag!.includes('open=""')).toBe(count !== 1);
  });
  it("excludes campaigns with no comparison activity from the count", () => {
    const zero = { spend: 0, impressions: 0, clicks: 0, cpc: null, ctr: null, results: 0, cpr: null };
    const html = markup([campaign("active"), { ...campaign("inactive"), current: zero, previous: zero }]);
    expect(html.match(/<details[^>]*aria-label="Account metrics"[^>]*>/)?.[0]).not.toContain('open=""');
  });
});
