import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import {
  buildComparisonCampaignSlideXml,
  buildComparisonCoverSlideXml,
  buildComparisonSummarySlideXml,
  COMPARISON_BG_REL_ID,
} from "../comparison-slides";
import { loadTemplate, type LoadedTemplate, type TemplateBackgroundImage } from "../package";
import type { ComparisonCampaignData, ComparisonChange, ComparisonReportData } from "../../nre/report-data";

const TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");

let template: LoadedTemplate;

beforeAll(async () => {
  template = await loadTemplate(fs.readFileSync(TEMPLATE_PATH));
});

const BACKGROUND: TemplateBackgroundImage = {
  blipXml: '<a:blip r:embed="rId1"/>',
  srcRectXml: "",
  offX: 0,
  offY: 0,
  extCx: 12192000,
  extCy: 6858000,
  mediaTarget: "../media/background.png",
};

function change(percent: number | null, direction: ComparisonChange["direction"]): ComparisonChange {
  return { percent, direction };
}

function metricSet(spend: number, reach: number, results: number, cpr: number) {
  return {
    spend: { value: spend, formatted: `$${spend}` },
    reach: { value: reach, formatted: reach.toLocaleString() },
    results: { value: results, formatted: String(results) },
    cpr: { value: cpr, formatted: cpr > 0 ? `$${cpr.toFixed(2)}` : "—" },
  };
}

function campaign(overrides: Partial<ComparisonCampaignData> = {}): ComparisonCampaignData {
  return {
    campaignName: "Shoes - Purchases",
    objective: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    metricsA: metricSet(1234, 45231, 47, 26.26),
    metricsB: metricSet(1102, 46710, 39, 28.26),
    changes: {
      spend: change(12, "up"),
      reach: change(-3, "down"),
      results: change(21, "up"),
      cpr: change(0, "flat"),
    },
    ...overrides,
  };
}

function comparisonData(overrides: Partial<ComparisonReportData> = {}): ComparisonReportData {
  const campaigns = overrides.campaigns ?? [campaign()];
  return {
    isPaused: false,
    accountName: "Acme Inc",
    reportDate: "08-07-2026",
    periodALabel: "Aug 1 - Aug 6, 2026",
    periodBLabel: "Jul 1 - Jul 6, 2026",
    campaigns,
    totals: {
      metricsA: metricSet(1234, 45231, 47, 26.26),
      metricsB: metricSet(1102, 46710, 39, 28.26),
      changes: {
        spend: change(12, "up"),
        reach: change(-3, "down"),
        results: change(21, "up"),
        cpr: change(0, "flat"),
      },
    },
    ...overrides,
  };
}

describe("buildComparisonCoverSlideXml", () => {
  it("titles the cover COMPARISON PERFORMANCE REPORT and shows both period labels", () => {
    const xml = buildComparisonCoverSlideXml(template.cover, comparisonData());
    expect(xml).toContain("COMPARISON PERFORMANCE REPORT");
    expect(xml).toContain("Acme Inc");
    expect(xml).toContain("Aug 1 - Aug 6, 2026");
    expect(xml).toContain("Jul 1 - Jul 6, 2026");
    expect(xml).not.toContain("{{"); // no leftover unfilled tags
  });

  it("respects a custom reportTitle over the default", () => {
    const xml = buildComparisonCoverSlideXml(template.cover, comparisonData(), { reportTitle: "Q3 Comparison Review" });
    expect(xml).toContain("Q3 COMPARISON REVIEW");
    expect(xml).not.toContain("COMPARISON PERFORMANCE REPORT");
  });
});

describe("buildComparisonCampaignSlideXml", () => {
  it("shows the campaign name, both period headers/labels, and the background image relationship", () => {
    const xml = buildComparisonCampaignSlideXml(campaign(), "Aug 1 - Aug 6, 2026", "Jul 1 - Jul 6, 2026", BACKGROUND);
    expect(xml).toContain("Shoes - Purchases (Campaign)");
    expect(xml).toContain("PERIOD A");
    expect(xml).toContain("PERIOD B");
    expect(xml).toContain("Aug 1 - Aug 6, 2026");
    expect(xml).toContain("Jul 1 - Jul 6, 2026");
    expect(xml).toContain(`r:embed="${COMPARISON_BG_REL_ID}"`);
  });

  it("shows AD SPEND, REACH, and the campaign's own objective/cost labels as the 4 metric rows", () => {
    const xml = buildComparisonCampaignSlideXml(campaign(), "A", "B", BACKGROUND);
    expect(xml).toContain("AD SPEND");
    expect(xml).toContain("REACH");
    expect(xml).toContain("PURCHASES");
    expect(xml).toContain("COST PER PURCHASE");
  });

  it("renders both periods' formatted values for each metric", () => {
    const xml = buildComparisonCampaignSlideXml(campaign(), "A", "B", BACKGROUND);
    expect(xml).toContain("$1234");
    expect(xml).toContain("$1102");
    expect(xml).toContain("47");
    expect(xml).toContain("39");
  });

  it("renders an up badge (green, ↑, rounded percent) for a positive change", () => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, spend: change(12.4, "up") } }), "A", "B", BACKGROUND);
    expect(xml).toContain("+12% ↑");
    expect(xml).toContain('srgbClr val="68d391"'); // CHANGE_UP_BG
  });

  it("renders a down badge (red, ↓, rounded percent) for a negative change", () => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, reach: change(-3.2, "down") } }), "A", "B", BACKGROUND);
    expect(xml).toContain("-3% ↓");
    expect(xml).toContain('srgbClr val="fc8181"'); // CHANGE_DOWN_BG
  });

  it("renders a flat badge (muted grey, → arrow, no NEW text) for a zero change", () => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, cpr: change(0, "flat") } }), "A", "B", BACKGROUND);
    expect(xml).toContain("0% →");
    expect(xml).toContain('srgbClr val="64748b"'); // CHANGE_FLAT_BG
  });

  it("renders a NEW badge (amber, 'NEW' text) when Period B was 0", () => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, results: change(null, "new") } }), "A", "B", BACKGROUND);
    expect(xml).toContain("NEW");
    expect(xml).toContain('srgbClr val="f6ad55"'); // CHANGE_NEW_BG
  });
});

describe("buildComparisonSummarySlideXml", () => {
  it("shows the title, both period labels, every campaign row, and a TOTAL row", () => {
    const twoCampaigns = comparisonData({
      campaigns: [
        campaign({ campaignName: "Campaign 1" }),
        campaign({
          campaignName: "Campaign 2",
          metricsA: metricSet(890, 20000, 31, 28.71),
          metricsB: metricSet(920, 21000, 35, 26.29),
          changes: { spend: change(-3, "down"), reach: change(-5, "down"), results: change(-11, "down"), cpr: change(9, "up") },
        }),
      ],
    });
    const xml = buildComparisonSummarySlideXml(twoCampaigns, BACKGROUND);

    expect(xml).toContain("CAMPAIGN COMPARISON SUMMARY");
    expect(xml).toContain("Aug 1 - Aug 6, 2026");
    expect(xml).toContain("Jul 1 - Jul 6, 2026");
    expect(xml).toContain("Campaign 1");
    expect(xml).toContain("Campaign 2");
    expect(xml).toContain("TOTAL");
    expect(xml).toContain(`r:embed="${COMPARISON_BG_REL_ID}"`);
  });

  it("truncates a campaign name longer than 28 characters with an ellipsis", () => {
    const longName = "A Very Long Campaign Name That Exceeds The Column Width";
    const data = comparisonData({ campaigns: [campaign({ campaignName: longName })] });
    const xml = buildComparisonSummarySlideXml(data, BACKGROUND);
    expect(xml).toContain(longName.slice(0, 28) + "…");
    expect(xml).not.toContain(longName);
  });

  it("colors positive Δ% green and negative Δ% red", () => {
    const data = comparisonData({
      campaigns: [
        campaign({ campaignName: "Up Campaign", changes: { ...campaign().changes, spend: change(12, "up") } }),
        campaign({ campaignName: "Down Campaign", changes: { ...campaign().changes, spend: change(-8, "down") } }),
      ],
    });
    const xml = buildComparisonSummarySlideXml(data, BACKGROUND);
    expect(xml).toContain('srgbClr val="68d391"'); // DELTA_UP_TEXT
    expect(xml).toContain('srgbClr val="fc8181"'); // DELTA_DOWN_TEXT
  });
});
