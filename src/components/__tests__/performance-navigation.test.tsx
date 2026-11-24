import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { clientCardActions } from "../client-card-actions";
import { ClientList } from "../client-list";
import { OverviewNavigation } from "../overview-navigation";
import { dashboardCopy } from "@/lib/dashboard-i18n";
const client = { id: "client-1", accountName: "Example", currency: "USD" as const, timezone: "UTC", hasGa4Property: true, ga4PropertyName: "Example GA4", hasPreviousMonthData: false, previousMonthDataUpdatedAt: null };
describe("client performance discovery", () => {
  it.each([false, true])("links client cards directly to performance without losing existing actions (%s)", scheduling => {
    const html = renderToStaticMarkup(<ClientList clients={[client]} totalCount={1} scheduling={scheduling} />);
    const actions = clientCardActions(client.id, scheduling);
    expect(actions.map(a => a.href)).toEqual(["/overview?client=client-1", scheduling ? "/clients/client-1/reports/new" : "/clients/client-1/schedules", "/clients/client-1"]);
    expect(actions[0].label).toBe("Performance (Meta Ads & GA4)");
    expect(html).toContain('aria-label="Client actions for Example"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`href="/clients/client-1/${scheduling ? "schedules" : "reports/new"}"`);

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
