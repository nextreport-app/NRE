import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clientCardActions } from "../client-card-actions";
import { ClientList } from "../client-list";
import { OverviewNavigation } from "../overview-navigation";
import { PerformanceBackLink } from "../performance-back-link";
import { dashboardCopy } from "@/lib/dashboard-i18n";
const client = { id: "client-1", accountName: "Example", currency: "USD" as const, timezone: "UTC", hasGa4Property: true, ga4PropertyName: "Example GA4", hasPreviousMonthData: false, previousMonthDataUpdatedAt: null };
describe("client performance discovery", () => {
  it.each([
    ["meta", "/performance/meta-ads", "All Meta ad accounts"],
    ["website", "/performance/google-analytics", "All websites"],
    ["seo", "/performance/search-console", "All search properties"],
  ] as const)("returns from %s to its unscoped portfolio", (view, href, label) => {
    const html = renderToStaticMarkup(<PerformanceBackLink view={view} />);
    expect(html).toContain('aria-label="Portfolio return"');
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain(label);
    expect(html).not.toContain("?client=");
    expect(html.match(/<a /g)).toHaveLength(1);
  });
  it.each([false, true])("links client cards directly to performance without losing existing actions (%s)", scheduling => {
    const html = renderToStaticMarkup(<ClientList clients={[client]} totalCount={1} scheduling={scheduling} />);
    const actions = clientCardActions(client.id, scheduling);
    expect(actions.map(a => a.href)).toEqual(["/performance/meta-ads?client=client-1", scheduling ? "/clients/client-1/reports/new" : "/clients/client-1/schedules", "/clients/client-1"]);
    expect(actions[0].label).toBe("Performance (Meta Ads, GA4 & SEO)");
    expect(html).toContain('aria-label="Client actions for Example"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`href="/clients/client-1/${scheduling ? "schedules" : "reports/new"}"`);

  });
  it.each(["meta", "website", "seo"] as const)("keeps the client when switching from %s", current => {
    const html = renderToStaticMarkup(<OverviewNavigation current={current} clientId="client&one" />);
    expect(html).toContain('href="/performance/meta-ads?client=client%26one"');
    expect(html).toContain('href="/performance/google-analytics?client=client%26one"');
    expect(html).toContain('href="/performance/search-console?client=client%26one"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("keeps portfolio navigation unscoped and names the header link Performance", () => {
    const html = renderToStaticMarkup(<OverviewNavigation current="meta" />);
    expect(html).toContain('href="/performance/meta-ads"');
    expect(html).toContain('href="/performance/google-analytics"');
    expect(dashboardCopy("en").navOverview).toBe("Performance");
  });
});
