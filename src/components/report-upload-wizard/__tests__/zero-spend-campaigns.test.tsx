import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardCampaignsStep } from "../steps/campaigns-step";

const state = vi.hoisted(() => ({ search: "", selected: new Set<string>() }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({
  step: 2, reportType: "WEEKLY", platform: "META", selectedCampaignsKey: () => "selection", metricsFetchedForSelection: null,
  ensureObjectivesForSelection: vi.fn(), selectedCampaigns: state.selected, campaignSearch: state.search,
  campaigns: ["Traffic", "Reach", "Small spend", "Credit adjustment", ...Array.from({ length: 1020 }, (_, i) => `Inactive ${i}`)],
  campaignSpend: { Traffic: 100, Reach: 200, "Small spend": 2, "Credit adjustment": -1, ...Object.fromEntries(Array.from({ length: 1020 }, (_, i) => [`Inactive ${i}`, 0])) },
  campaignRequiresConfirmation: new Map(), touchedObjectiveCampaigns: new Set(), campaignObjectives: new Map(), campaignObjectiveConfidence: new Map(), campaignCsvResultTypes: new Map(),
  adSetGroups: [], expandedCampaigns: new Set(), selectedAdSets: new Set(), lowSpendCampaigns: [], currencySymbol: "$", metricsStatus: "idle", hasBlockingObjectives: () => false,
}) }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../ui/wizard-step-help", () => ({ WizardStepHelp: () => null }));
vi.mock("../ui/wizard-sticky-footer", () => ({ WizardStickyFooter: () => null }));
beforeEach(() => { state.search = ""; state.selected = new Set(); });

describe("zero-spend campaign disclosure", () => {
  it("keeps 1,020 inactive campaigns out of the initial DOM while leaving small and negative spend visible", () => {
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain("Zero-spend campaigns (1,020)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="campaign-Inactive');
    for (const name of ["Traffic", "Reach", "Small spend", "Credit adjustment"]) expect(html).toContain(`id="campaign-${name}"`);
    expect(html).toContain("0 of 1024 included");
    expect(html).toContain("Select all campaigns");
  });
  it("searches inactive campaigns without requiring an expansion first", () => {
    state.search = "Inactive 1019";
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain('id="campaign-Inactive 1019"');
    expect(html).not.toContain('id="campaign-Traffic"');
    expect(html).not.toContain("Zero-spend campaigns (");
  });
  it("keeps included inactive campaigns counted when collapsed", () => {
    state.selected = new Set(["Traffic", "Inactive 1019"]);
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain("2 of 1024 included");
    expect(html).toContain("1 included · Expand to review or include");
    expect(html).not.toContain('id="campaign-Inactive');
  });
});
