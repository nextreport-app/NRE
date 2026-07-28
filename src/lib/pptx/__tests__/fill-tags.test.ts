import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { buildCoverSlideXml, buildCampaignOrAdSetSlideXml, DEFAULT_REPORT_TITLE } from "../fill-tags";
import { loadTemplate, type LoadedTemplate } from "../package";
import type { CoverData, CampaignSlideData } from "../../nre/report-data";

const TEMPLATE_PATH = path.resolve(__dirname, "../../../../templates/dark.pptx");

let template: LoadedTemplate;

beforeAll(async () => {
  template = await loadTemplate(fs.readFileSync(TEMPLATE_PATH));
});

const BASE_COVER: CoverData = {
  accountName: "Acme Inc",
  reportDate: "Jul 20, 2026",
  dateRange: "Jul 13 - Jul 19",
  healthBadge: "Healthy",
  healthScore: 90,
  budgetSummary: "$100 spent",
};

function makeCampaignSlide(campaignName: string): CampaignSlideData {
  return {
    kind: "campaign",
    campaignName,
    resultLabel: "RESULTS",
    costLabel: "COST PER RESULT",
    metrics: {
      spend: "$100",
      reach: "1,000",
      impressions: "3,000",
      results: "2",
      cpr: "$50",
      ctr: "1.5%",
      cpc: "$3",
    },
    dateRangeLine: "Jul 13 - Jul 19",
    avgFreq: 3,
    ai: {
      ctx: "context",
      dateRange: "Jul 13 - Jul 19",
      spend: "$100",
      reach: "1,000",
      impressions: "3,000",
      results: "2",
      cpr: "$50",
      ctr: "1.5%",
      cpc: "$3",
      resultLabel: "RESULTS",
      costLabel: "COST PER RESULT",
      freq: 3,
      resultsNum: 2,
      hasResults: true,
      spendNum: 100,
    },
    statusIndicator: null,
  };
}

// Extracts the sz="NNNN" (hundredths of a point) of the run containing `text`.
function sizeOfRunContaining(xml: string, text: string): number {
  const idx = xml.indexOf(`<a:t>${text}</a:t>`);
  expect(idx).toBeGreaterThan(-1);
  const runStart = xml.lastIndexOf("<a:r>", idx);
  const rPrMatch = /sz="(\d+)"/.exec(xml.slice(runStart, idx));
  expect(rPrMatch).not.toBeNull();
  return Number(rPrMatch![1]) / 100;
}

describe("buildCoverSlideXml — account name auto-shrink (regression)", () => {
  it("renders a short account name at the maximum 28pt candidate", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(sizeOfRunContaining(xml, "Acme Inc")).toBe(28);
  });

  it("shrinks the reported long account name down to 16pt so it fits on one line", () => {
    const longName = "Alonzo Carr (Tailored Fiduciary Services)";
    const xml = buildCoverSlideXml(template.cover, { ...BASE_COVER, accountName: longName });
    expect(sizeOfRunContaining(xml, longName)).toBe(16);
  });
});

describe("buildCoverSlideXml — report title", () => {
  it("falls back to DEFAULT_REPORT_TITLE, upper-cased, when no title is given", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(xml).toContain(`<a:t>${DEFAULT_REPORT_TITLE.toUpperCase()}</a:t>`);
  });

  it("falls back to DEFAULT_REPORT_TITLE when given a blank/whitespace title", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { reportTitle: "   " });
    expect(xml).toContain(`<a:t>${DEFAULT_REPORT_TITLE.toUpperCase()}</a:t>`);
  });

  it("renders a custom title, upper-cased to match the template's all-caps styling", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { reportTitle: "Q3 Performance Review" });
    expect(xml).toContain("<a:t>Q3 PERFORMANCE REVIEW</a:t>");
    expect(xml).not.toContain(DEFAULT_REPORT_TITLE.toUpperCase());
  });
});

describe("buildCoverSlideXml — Prepared By line", () => {
  it("adds no PREPARED_BY text and doesn't move PRESENTED_TO/ACCOUNT_NAME when no agency name is set", () => {
    const withoutAgency = buildCoverSlideXml(template.cover, BASE_COVER);
    const baseline = buildCoverSlideXml(template.cover, BASE_COVER, {});
    // No agencyName in either call — cover renders pixel-identical either way.
    expect(withoutAgency).toBe(baseline);
    expect(withoutAgency).not.toContain("Prepared by");
  });

  it("adds a 'Prepared by <agency>' line when an agency name is set", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { agencyName: "Bright Path Marketing" });
    expect(xml).toContain("<a:t>Prepared by Bright Path Marketing</a:t>");
  });

  it("shifts PRESENTED_TO and ACCOUNT_NAME up when an agency name is set, so the new line doesn't overlap them", () => {
    const withoutAgency = buildCoverSlideXml(template.cover, BASE_COVER);
    const withAgency = buildCoverSlideXml(template.cover, BASE_COVER, { agencyName: "Bright Path Marketing" });

    const presentedToY = (xml: string) => {
      const idx = xml.indexOf("PRESENTED TO");
      const spStart = xml.lastIndexOf("<p:sp>", idx);
      return Number(/<a:off x="\d+" y="(\d+)"/.exec(xml.slice(spStart, idx))![1]);
    };
    expect(presentedToY(withAgency)).toBeLessThan(presentedToY(withoutAgency));
  });

  it("ignores a blank/whitespace-only agency name the same as no agency name", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { agencyName: "   " });
    expect(xml).not.toContain("Prepared by");
    expect(xml).not.toContain("{{PREPARED_BY}}");
  });
});

describe("buildCoverSlideXml — health-score tooltip", () => {
  const SLIDE_HEIGHT_EMU = 6858000;

  function shapeBox(xml: string, locator: string): { y: number; cy: number } {
    const idx = xml.indexOf(locator);
    expect(idx).toBeGreaterThan(-1);
    const start = xml.lastIndexOf("<p:sp>", idx);
    const end = xml.indexOf("</p:sp>", idx);
    const match = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(xml.slice(start, end));
    expect(match).not.toBeNull();
    const [, , y, , cy] = match!;
    return { y: Number(y), cy: Number(cy) };
  }

  it("appends the ⓘ icon right after the badge text", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(xml).toContain("<a:t>Healthy</a:t>");
    // The icon is a separate run immediately following the badge's own run,
    // inside the same paragraph — not appended to the badge string itself.
    const badgeIdx = xml.indexOf("<a:t>Healthy</a:t>");
    expect(xml.slice(badgeIdx, badgeIdx + 600)).toContain("<a:t> ⓘ</a:t>");
  });

  it("renders the fixed tooltip sentence at 9pt, italic, muted grey", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    const tooltipText = "Score reflects delivery health: reach, engagement, frequency and spend efficiency. Conversion targets are detailed in slides below.";
    expect(xml).toContain(`<a:t>${tooltipText}</a:t>`);
    const idx = xml.indexOf(`<a:t>${tooltipText}</a:t>`);
    const runStart = xml.lastIndexOf("<a:r>", idx);
    const rPr = xml.slice(runStart, idx);
    expect(rPr).toContain('sz="900"');
    expect(rPr).toContain('i="1"');
    expect(rPr).toContain('<a:srgbClr val="999999"/>');
  });

  it("always renders the tooltip, even with no agency name / budget set (not conditional like Prepared By)", () => {
    const xml = buildCoverSlideXml(template.cover, { ...BASE_COVER, budgetSummary: "" });
    expect(xml).toContain("Score reflects delivery health");
  });

  it("keeps the badge, tooltip, and budget-summary shapes stacked in order, fully within the slide's vertical bounds", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    const badgeBox = shapeBox(xml, "Healthy");
    const tooltipBox = shapeBox(xml, "Score reflects delivery health");
    const budgetBox = shapeBox(xml, "$100 spent");

    expect(tooltipBox.y).toBeGreaterThanOrEqual(badgeBox.y + badgeBox.cy);
    expect(budgetBox.y).toBeGreaterThanOrEqual(tooltipBox.y + tooltipBox.cy);
    expect(budgetBox.y + budgetBox.cy).toBeLessThanOrEqual(SLIDE_HEIGHT_EMU);
  });
});

describe("buildCampaignOrAdSetSlideXml — campaign name auto-shrink (regression)", () => {
  it("renders a short campaign name at the maximum 18pt candidate", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"));
    expect(sizeOfRunContaining(xml, "Shoes - Purchases (Campaign)")).toBe(18);
  });

  it("shrinks a very long campaign name below 18pt so it fits on one line", () => {
    const longCampaignName =
      "Q3 2026 National Brand Awareness and Retargeting Campaign for All Product Lines";
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide(longCampaignName));
    const heading = `${longCampaignName} (Campaign)`;
    const size = sizeOfRunContaining(xml, heading);
    expect(size).toBeLessThan(18);
    expect([16, 14, 12]).toContain(size);
  });
});
