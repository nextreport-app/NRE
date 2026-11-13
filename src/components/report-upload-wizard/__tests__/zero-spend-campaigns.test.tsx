import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardCampaignsStep } from "../steps/campaigns-step";

const state = vi.hoisted(() => ({ search: "", selected: new Set<string>(), missingSpend: false }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({
  step: 2, reportType: "WEEKLY", platform: "META", selectedCampaignsKey: () => "selection", metricsFetchedForSelection: null,
  ensureObjectivesForSelection: vi.fn(), selectedCampaigns: state.selected, campaignSearch: state.search,
  campaigns: ["Traffic", "Reach", "Small spend", "Credit adjustment", ...Array.from({ length: 1020 }, (_, i) => `Inactive ${i}`)],
  campaignSpend: { Traffic: state.missingSpend ? undefined : 100, Reach: 200, "Small spend": 2, "Credit adjustment": -1, ...Object.fromEntries(Array.from({ length: 1020 }, (_, i) => [`Inactive ${i}`, 0])) },
  campaignRequiresConfirmation: new Map(), touchedObjectiveCampaigns: new Set(), campaignObjectives: new Map(), campaignObjectiveConfidence: new Map(), campaignCsvResultTypes: new Map(),
  adSetGroups: [], expandedCampaigns: new Set(), selectedAdSets: new Set(), zeroSpendCampaigns: Array.from({length:1020},(_,i)=>`Inactive ${i}`), campaignSpendLabel: "Reporting-period spend · 2026-11-01 – 2026-11-07", currencySymbol: "$", metricsStatus: "idle", hasBlockingObjectives: () => false,
}) }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../ui/wizard-step-help", () => ({ WizardStepHelp: () => null }));
vi.mock("../ui/wizard-sticky-footer", () => ({ WizardStickyFooter: () => null }));
beforeEach(() => { state.search = ""; state.selected = new Set(); state.missingSpend = false; });

describe("zero-spend campaign disclosure", () => {
  it("keeps 1,020 inactive campaigns out of the initial DOM while leaving small and negative spend visible", () => {
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain("No spend in report dates (1,020)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="campaign-Inactive');
    for (const name of ["Traffic", "Reach", "Small spend", "Credit adjustment"]) expect(html).toContain(`id="campaign-${name}"`);
    expect(html).toContain("0 of 1024 included");
    expect(html).toContain("Select all campaigns");
    expect(html).not.toContain("$100"); expect(html).not.toContain("$200"); expect(html).not.toContain("$2 spend");
    expect(html).not.toContain("Last 30 days spend detected"); expect(html).not.toContain("text-amber-400");
    expect(html).not.toContain("Campaigns with no spend in this reporting period");
    expect(html).not.toContain("Reporting-period spend");
    expect(html).not.toContain("Optional ad-set slides");
    expect(html).not.toContain("Campaign totals already include all ad sets");
  });
  it("does not label missing spend as a measured zero", () => {
    state.missingSpend = true;
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).not.toContain("Spend unavailable");
    expect(html).toContain('id="campaign-Traffic"');
    expect(html).not.toContain("Last 30 days spend detected · $0");
    expect(html).toContain("No spend in report dates (1,020)");
  });
  it("searches inactive campaigns without requiring an expansion first", () => {
    state.search = "Inactive 1019";
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain('id="campaign-Inactive 1019"');
    expect(html).not.toContain('id="campaign-Traffic"');
    expect(html).not.toContain("No spend in report dates (");
  });
  it("keeps included inactive campaigns counted when collapsed", () => {
    state.selected = new Set(["Traffic", "Inactive 1019"]);
    const html = renderToStaticMarkup(<WizardCampaignsStep />);
    expect(html).toContain("2 of 1024 included");
    expect(html).toContain("1 included · Expand to review");
    expect(html).not.toContain('id="campaign-Inactive');
  });
});
