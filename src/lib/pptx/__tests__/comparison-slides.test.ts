import { buildComparisonExtraSlide } from "../comparison-extra-slide";
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

  it("keeps spend changes neutral while preserving their numerical direction", () => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, spend: change(12.4, "up") } }), "A", "B", BACKGROUND);
    expect(xml).toContain("+12% ↑");
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    const badge = shapes.findIndex(shape => shape.includes(">+12% ↑<"));
    expect(shapes[badge - 1]).toContain('srgbClr val="64748b"');
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

describe.each([false, true])("metric-aware comparison badges (light=%s)", light => {
  it("uses identical card geometry, heading, fonts and badges for default and additional slides", () => {
    const original = campaign();
    const main = buildComparisonCampaignSlideXml(original, "A", "B", BACKGROUND, light);
    const labels = { spend: "AD SPEND", reach: "REACH", results: original.objective, cpr: original.costLabel };
    const metrics = (["spend", "reach", "results", "cpr"] as const).map(key => ({ key, label: labels[key], valueA: original.metricsA[key].value, valueB: original.metricsB[key].value, formattedA: original.metricsA[key].formatted, formattedB: original.metricsB[key].formatted, percent: original.changes[key].percent }));
    const extra = buildComparisonExtraSlide({ campaignName: original.campaignName, metrics, periodALabel: "A", periodBLabel: "B", page: 0, pages: 1, background: BACKGROUND, isLightTemplate: light });
    const shapes = (xml: string) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    expect(shapes(extra).slice(0, -1)).toEqual(shapes(main));
  });
  it("applies the same semantic colours to additional cost and CTR metrics", () => {
    const metric = { valueA: 20, valueB: 9, formattedA: "$20", formattedB: "$9" };
    const xml = buildComparisonExtraSlide({ campaignName: "Example", metrics: [{ ...metric, key: "cost_per_lpv", label: "COST PER LPV", percent: 120 }, { ...metric, key: "ctr", label: "CTR", percent: 30 }], periodALabel: "A", periodBLabel: "B", page: 0, pages: 1, background: BACKGROUND, isLightTemplate: light });
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    expect(shapes[shapes.findIndex(shape => shape.includes(">+120% ↑<")) - 1]).toContain('srgbClr val="fc8181"');
    expect(shapes[shapes.findIndex(shape => shape.includes(">+30% ↑<")) - 1]).toContain('srgbClr val="68d391"');
  });
  it.each([[120, "up", "fc8181"], [-50, "down", "68d391"]] as const)("uses the correct cost-per-result colour for %s percent", (percent, direction, color) => {
    const xml = buildComparisonCampaignSlideXml(campaign({ changes: { ...campaign().changes, cpr: change(percent, direction) } }), "A", "B", BACKGROUND, light);
    const shapes = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]);
    const text = percent > 0 ? "+120% ↑" : "-50% ↓";
    const badge = shapes.findIndex(shape => shape.includes(`>${text}<`));
    expect(badge).toBeGreaterThan(0);
    expect(shapes[badge - 1]).toContain(`srgbClr val="${color}"`);
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("single-line comparison dates in %s", file => {
  it("widens only the date shape and disables wrapping, including long cross-year ranges", async () => {
    const source = await loadTemplate(fs.readFileSync(path.resolve(__dirname, "../../../../templates", file)));
    const data = comparisonData({ periodALabel: "December 1 - December 31, 2026", periodBLabel: "November 1 - November 30, 2025" });
    const xml = buildComparisonCoverSlideXml(source.cover, data, { agencyName: "Example agency" });
    const dateShape = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).find(shape => shape.includes(data.periodALabel))!;
    expect(dateShape).toContain(data.periodBLabel);
    expect(dateShape).toContain('wrap="none"');
    expect(dateShape).toContain('cx="11176000"');
    expect(xml).toContain("Prepared by Example agency");
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

  it("uses more space for campaign names before truncating very long names", () => {
    const longName = "A Very Long Campaign Name That Exceeds The Column Width";
    const data = comparisonData({ campaigns: [campaign({ campaignName: longName })] });
    const xml = buildComparisonSummarySlideXml(data, BACKGROUND);
    expect(xml).toContain(longName.slice(0, 23) + "…" + longName.slice(-15));
    expect(xml).not.toContain(longName);
  });

  it("colours results changes by performance while leaving spend changes neutral", () => {
    const data = comparisonData({
      campaigns: [
        campaign({ campaignName: "Up Campaign", changes: { ...campaign().changes, spend: change(12, "up") } }),
        campaign({ campaignName: "Down Campaign", changes: { ...campaign().changes, spend: change(-8, "down"), results: change(-11, "down") } }),
      ],
    });
    const xml = buildComparisonSummarySlideXml(data, BACKGROUND);
    expect(xml).toContain('srgbClr val="68d391"'); // DELTA_UP_TEXT
    expect(xml).toContain('srgbClr val="fc8181"'); // DELTA_DOWN_TEXT
  });
});
