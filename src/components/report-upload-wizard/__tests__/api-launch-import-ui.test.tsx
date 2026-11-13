import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardDataSourceToggle, WizardDataSourcePanel } from "@/components/wizard-data-source-panel";
import { MetaAdsSettings } from "@/components/meta-ads-settings";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
describe("live Meta import choice", () => {
  it("shows both methods for a new user without a launch gate", () => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value="csv" onChange={() => {}} />);
    expect(html).toContain("Upload CSV"); expect(html).toContain("Meta API");
    expect(html).toContain('role="group"');
    expect(html).not.toContain('disabled=""'); expect(html).not.toContain("Launching soon");
  });
  it.each(["csv","api"] as const)("keeps the remembered %s method with an obvious way to change", value => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value={value} onChange={() => {}} />);
    expect(html).toContain("Meta API"); expect(html).toContain("Upload CSV");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("Change import method"); expect(html).not.toContain("Manual export from Ads Manager");
  });
  it("keeps CSV discoverable when the operational API kill switch is set", () => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value="api" apiUnavailable onChange={() => {}} />);
    expect(html).toContain("Upload CSV"); expect(html).toContain("temporarily unavailable"); expect(html).not.toContain("Launching soon");
  });
  it("presents account connections as live, optional and read-only", () => {
    const html = renderToStaticMarkup(<MetaAdsSettings initialConnectedName="Agency" initialConnectedUserId="123" justConnected={false} connectError={null} metaConfigured />);
    expect(html).toContain("Live"); expect(html).toContain("cannot create or edit ads");
    expect(html).toContain("Manual CSV upload is also available"); expect(html).not.toContain("In testing");
  });
});


describe("API error actions", () => {
  const props = { clientId: "client", platform: "META" as const, metaConfigured: true, metaConnected: true, metaConnectedName: "Example", googleAdsConfigured: false, googleAdsConnected: false, tiktokConfigured: false, tiktokConnected: false, onSynced: () => {}, onSyncStart: () => {}, onSyncError: () => {}, onUseCsv: () => {}, syncStatus: "error" as const, syncError: "Meta is temporarily unavailable." };
  it("offers Retry and Use CSV instead without a second competing sync button", () => {
    const html = renderToStaticMarkup(<WizardDataSourcePanel {...props} />);
    expect(html).toContain("Retry"); expect(html).toContain("Use CSV instead");
    expect(html).not.toContain("Sync &amp; analyze"); expect(html).not.toContain("Your file is still selected");
  });
  it("offers CSV when connection was cancelled before account access", () => {
    const html = renderToStaticMarkup(<WizardDataSourcePanel {...props} metaConnected={false} />);
    expect(html).toContain("Use CSV instead"); expect(html).toContain("Connect Meta Ads");
  });
  it("offers CSV when the server connection is unavailable without implementation details", () => {
    const html = renderToStaticMarkup(<WizardDataSourcePanel {...props} metaConfigured={false} metaConnected={false} syncError={null} />);
    expect(html).toContain("Use CSV instead"); expect(html).not.toContain("credentials");
  });
});
