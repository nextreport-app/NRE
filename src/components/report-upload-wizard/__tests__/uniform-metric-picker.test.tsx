import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardMetricsStep } from "../steps/metrics-step";
const state = vi.hoisted(() => ({ type: "WEEKLY" }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({ step: 3, reportType: state.type, platform: "META", campaigns: ["Example"], selectedCampaigns: new Set(["Example"]), perCampaignMetrics: new Map([["example", [{ key: "spend", label: "AD SPEND" }]]]), campaignObjectives: new Map(), perCampaignMinWarning: null, MIN_SELECTED_METRICS: 1, MAX_METRICS_PER_SLIDE: 8, MAX_TOTAL_METRICS: 64, campaignAvailableMetrics: () => [{ key: "link_clicks", label: "LINK CLICKS" }], objectiveAccent: () => ({ borderHex: "#38bdf8" }), comparisonMetricKeys: ["link_clicks"], dailyMetricKeys: ["link_clicks"], comparisonOptionalMetrics: [{ key: "link_clicks", label: "LINK CLICKS" }], dailyOptionalMetrics: [{ key: "link_clicks", label: "LINK CLICKS" }] }) }));
vi.mock("@/hooks/use-wizard-copy", () => ({ useWizardCopy: () => ({ back: "Back", continueToGenerate: "Continue to generate", stepOf: () => "Metrics" }) }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../ui/wizard-step-help", () => ({ WizardStepHelp: () => null }));
vi.mock("../ui/wizard-sticky-footer", () => ({ WizardStickyFooter: () => null }));
describe.each(["WEEKLY", "MONTHLY", "COMPARISON", "DAY_BREAKDOWN"])("uniform metric screen: %s", type => {
  it("uses the same chip picker, optional expansion, CSV extras and navigation", () => {
    state.type = type;
    const html = renderToStaticMarkup(<WizardMetricsStep />);
    expect(html).toContain("Included metrics");
    expect(html).toContain("Add more metrics · optional");
    expect(html).toContain("Add from CSV");
    expect(html).toContain("LINK CLICKS");
    expect(html).toContain("Continue to generate");
    expect(html).not.toContain("Metrics are fixed");
    if (["COMPARISON", "DAY_BREAKDOWN"].includes(type)) {
      expect(html).toContain('aria-label="Remove LINK CLICKS"');
      expect(html).not.toContain('aria-label="Remove Ad spend"');
    }
  });
});
