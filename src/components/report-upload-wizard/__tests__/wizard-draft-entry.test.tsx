import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useReportUploadWizard } from "../use-report-upload-wizard";
const navigation = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
function EntryProbe() {
  const w = useReportUploadWizard({ clientId: "example", clientName: "Example", clientTimezone: "UTC", currencySymbol: "$", hasGoogleDriveConnected: false, initialLastDriveFolderId: null, initialLastDriveFolderName: null, initialPreviousMonthDataUpdatedAt: null, hasPreviousMonthData: false, clientTemplate: "DARK" });
  return <output>{JSON.stringify({ step: w.step, restoringDraft: w.wizardDraftBootstrapping, resumingReport: w.resumeBootstrapping, uploadSessionId: w.uploadSessionId })}</output>;
}
afterEach(() => { vi.unstubAllGlobals(); navigation.query = ""; });
describe("new report entry", () => {
  it.each([2, 3, 4])("does not bootstrap saved step %i when opening a new report", step => {
    // Simulate the stale tab session that survives laptop sleep and re-login.
    const draft = { version: 1, savedAt: new Date().toISOString(), step, uploadSessionId: "saved-session", platform: "META", reportType: "WEEKLY" };
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: () => JSON.stringify(draft) });
    const html = renderToStaticMarkup(<EntryProbe />);
    expect(html).toContain('&quot;step&quot;:1');
    expect(html).toContain('&quot;restoringDraft&quot;:false');
    expect(html).toContain('&quot;uploadSessionId&quot;:null');
  });
  it("preserves explicit generated-report return handling", () => {
    navigation.query = "resumeReport=existing-report";
    expect(renderToStaticMarkup(<EntryProbe />)).toContain('&quot;resumingReport&quot;:true');
  });
});
