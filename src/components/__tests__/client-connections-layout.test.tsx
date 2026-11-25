import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientProviderSettings } from "../client-provider-settings";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("Client connection workspace", () => {
  it("keeps property selection with GA4 and labels shared automations without changing OAuth scope", () => {
    const html = renderToStaticMarkup(<ClientProviderSettings
      clientId="client-a"
      connections={[
        { provider: "ga4", scoped: true, connected: true, label: "client@example.test", configured: true },
        { provider: "meta", scoped: false, connected: true, label: "Agency profile", configured: true },
        { provider: "tiktok", scoped: false, connected: false, label: null, configured: false },
      ]}
      ga4Property={<div id="website-analytics">Property selector</div>}
      automations={<div>Slack, Zapier &amp; Make · Agency-wide</div>}
    />);
    const ga4Card = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
    expect(ga4Card).toContain('id="website-analytics"');
    expect(ga4Card).toContain("Property selector");
    expect(html).toContain('href="/api/ga4/connect?clientId=client-a"');
    expect(html).toContain('href="/api/meta/connect?clientId=client-a"');
    expect(html).not.toContain("/api/tiktok/connect");
    expect(html).toContain("Choose different login");
    expect(html).toContain("Agency-wide");
    expect(html).not.toContain("Other clients keep their connections");
    expect(html).not.toContain("After changing a Meta");
  });
});
