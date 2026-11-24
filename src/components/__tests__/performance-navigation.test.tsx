import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientList } from "../client-list";
import { OverviewNavigation } from "../overview-navigation";
import { dashboardCopy } from "@/lib/dashboard-i18n";
const client = { id: "client-1", accountName: "Example", currency: "USD" as const, timezone: "UTC", hasGa4Property: true, ga4PropertyName: "Example GA4", hasPreviousMonthData: false, previousMonthDataUpdatedAt: null };
describe("client performance discovery", () => {
  it.each([false, true])("links client cards directly to performance without losing existing actions (%s)", scheduling => {
    const html = renderToStaticMarkup(<ClientList clients={[client]} totalCount={1} scheduling={scheduling} />);
    expect(html).toContain('href="/overview?client=client-1"');
    expect(html).toContain('aria-label="View performance for Example"');
    expect(html).toContain("Meta Ads &amp; GA4");
    expect(html).toContain('href="/clients/client-1/schedules"');
    expect(html).toContain('href="/clients/client-1/reports/new"');
    expect(html).toContain('aria-label="Manage Example"');
  });
  it.each(["meta", "website"] as const)("keeps the client when switching from %s", current => {
    const html = renderToStaticMarkup(<OverviewNavigation current={current} clientId="client&one" />);
    expect(html).toContain('href="/overview?client=client%26one"');
    expect(html).toContain('href="/websites?client=client%26one"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("keeps portfolio navigation unscoped and names the header link Performance", () => {
    const html = renderToStaticMarkup(<OverviewNavigation current="meta" />);
    expect(html).toContain('href="/overview"');
    expect(html).toContain('href="/websites"');
    expect(dashboardCopy("en").navOverview).toBe("Performance");
  });
});
