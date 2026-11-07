import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardDataSourceToggle } from "@/components/wizard-data-source-panel";
import { MetaAdsSettings } from "@/components/meta-ads-settings";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
describe("live Meta import choice", () => {
  it("shows both methods for a new user without a launch gate", () => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value="csv" onChange={() => {}} />);
    expect(html).toContain("Manual CSV upload"); expect(html).toContain("Connect your data via API");
    expect(html).not.toContain("disabled"); expect(html).not.toContain("Launching soon");
  });
  it.each(["csv","api"] as const)("keeps the remembered %s method compact with an obvious way to change", value => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value={value} compact onChange={() => {}} />);
    expect(html).toContain(value === "api" ? "Meta API sync" : "Manual CSV upload");
    expect(html).toContain("Change import method"); expect(html).not.toContain("Manual export from Ads Manager");
  });
  it("keeps CSV discoverable when the operational API kill switch is set", () => {
    const html = renderToStaticMarkup(<WizardDataSourceToggle value="api" compact apiUnavailable onChange={() => {}} />);
    expect(html).toContain("Manual CSV upload"); expect(html).toContain("Temporarily unavailable"); expect(html).not.toContain("Launching soon");
  });
  it("presents account connections as live, optional and read-only", () => {
    const html = renderToStaticMarkup(<MetaAdsSettings initialConnectedName="Agency" initialConnectedUserId="123" justConnected={false} connectError={null} metaConfigured />);
    expect(html).toContain("Live"); expect(html).toContain("cannot create or edit ads");
    expect(html).toContain("Manual CSV upload is also available"); expect(html).not.toContain("In testing");
  });
});
