import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardMetricsStep } from "../steps/metrics-step";
const state = vi.hoisted(() => ({ type: "WEEKLY", count: 1, source: "csv" }));
vi.mock("../wizard-context", () => ({ useWizardContext: () => ({ step: 3, reportType: state.type, platform: "META", dataSourceMode: state.source, campaigns: ["Example", "Second", "Third"].slice(0, state.count), selectedCampaigns: new Set(["Example", "Second", "Third"].slice(0, state.count)), perCampaignMetrics: new Map([["example", [{ key: "spend", label: "AD SPEND" }]]]), campaignObjectives: new Map([["example", { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" }]]), perCampaignMinWarning: null, MIN_SELECTED_METRICS: 1, MAX_METRICS_PER_SLIDE: 8, MAX_TOTAL_METRICS: 64, campaignAvailableMetrics: () => [{ key: "link_clicks", label: "LINK CLICKS" }], objectiveAccent: () => ({ borderHex: "#38bdf8" }), comparisonMetricKeys: ["link_clicks"], dailyMetricKeys: ["link_clicks"], comparisonOptionalMetrics: [{ key: "link_clicks", label: "LINK CLICKS" }], dailyOptionalMetrics: [{ key: "link_clicks", label: "LINK CLICKS" }] }) }));
vi.mock("@/hooks/use-wizard-copy", () => ({ useWizardCopy: () => ({ back: "Back", continueToGenerate: "Continue to generate", stepOf: () => "Metrics" }) }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../ui/wizard-step-help", () => ({ WizardStepHelp: () => null }));
vi.mock("../ui/wizard-sticky-footer", () => ({ WizardStickyFooter: () => null }));
beforeEach(() => { state.count = 1; state.source = "csv"; });

describe.each(["WEEKLY", "MONTHLY", "COMPARISON", "DAY_BREAKDOWN"])("uniform metric screen: %s", type => {
  it("uses the same chip picker, optional expansion, CSV extras and navigation", () => {
    state.type = type;
    const html = renderToStaticMarkup(<WizardMetricsStep />);
    expect(html).not.toContain("Included metrics");
    expect(html).toContain('aria-label="Selected metrics"');
    expect(html).toContain("Add more metrics · optional");
    expect(html).toContain("Available metrics detected from your CSV.");
    expect(html).toContain("LINK CLICKS");
    expect(html).toContain("Continue to generate");
    expect(html).not.toContain("Metrics are fixed");
    if (["COMPARISON", "DAY_BREAKDOWN"].includes(type)) {
      expect(html).toContain('aria-label="Remove LINK CLICKS"');
      expect(html).toContain("WEBSITE LEADS");
      expect(html).toContain("COST PER WEBSITE LEAD");
      expect(html).not.toContain("Objective-specific results");
      expect(html).not.toContain("Results for campaign objective");
      if (type === "DAY_BREAKDOWN") {
        expect(html).toContain('aria-label="Remove Ad spend"');
        expect(html).not.toContain(">Included</span>");
        expect(html).not.toContain("Extras appear on additional daily tables.");
        expect(html).not.toContain("Missing values show N/A;");
      } else expect(html).not.toContain('aria-label="Remove Ad spend"');
    }
  });
});

describe("concise metric review copy", () => {
  it("shows only the campaign count and requested CSV introduction", () => {
    state.type = "WEEKLY"; state.count = 3;
    const html = renderToStaticMarkup(<WizardMetricsStep />);
    expect(html).toContain("3 campaigns");
    expect(html).toContain("Metrics are selected from your CSV. Review or expand to customize.");
    expect(html).not.toContain("selected from your imported data");
    expect(html).not.toContain("Included metrics");
  });
  it("identifies API imports accurately", () => {
    state.type = "WEEKLY"; state.source = "api";
    const html = renderToStaticMarkup(<WizardMetricsStep />);
    expect(html).toContain("Metrics are selected from Meta API. Review or expand to customize.");
    expect(html).toContain("Available metrics detected from Meta API.");
    expect(html).not.toContain("your CSV");
  });
});
