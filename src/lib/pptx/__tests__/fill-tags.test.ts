import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { buildCoverSlideXml, buildCampaignOrAdSetSlideXml, buildPausedSlideXml, DEFAULT_REPORT_TITLE } from "../fill-tags";
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

  it("Fix 8: falls back to MONTHLY PERFORMANCE REPORT when reportType is MONTHLY and no title is given", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { reportType: "MONTHLY" });
    expect(xml).toContain("<a:t>MONTHLY PERFORMANCE REPORT</a:t>");
    expect(xml).not.toContain(DEFAULT_REPORT_TITLE.toUpperCase());
  });

  it("Fix 8: an explicit reportTitle always wins over reportType's default, even when MONTHLY", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { reportTitle: "Q3 Performance Review", reportType: "MONTHLY" });
    expect(xml).toContain("<a:t>Q3 PERFORMANCE REVIEW</a:t>");
    expect(xml).not.toContain("MONTHLY PERFORMANCE REPORT");
  });

  it("Fix 8: reportType WEEKLY (or omitted) still falls back to WEEKLY PERFORMANCE REPORT", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER, { reportType: "WEEKLY" });
    expect(xml).toContain(`<a:t>${DEFAULT_REPORT_TITLE.toUpperCase()}</a:t>`);
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

describe("buildCoverSlideXml — health badge (Fix 2 revert: no tooltip, no icon)", () => {
  function shapeY(xml: string, locator: string): number {
    const idx = xml.indexOf(locator);
    expect(idx).toBeGreaterThan(-1);
    const start = xml.lastIndexOf("<p:sp>", idx);
    const end = xml.indexOf("</p:sp>", idx);
    const match = /<a:off x="(-?\d+)" y="(-?\d+)"\/>/.exec(xml.slice(start, end));
    expect(match).not.toBeNull();
    return Number(match![2]);
  }

  it("shows only the badge text, with no ⓘ icon appended", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(xml).toContain("<a:t>Healthy</a:t>");
    expect(xml).not.toContain("ⓘ");
  });

  it("adds no explanatory tooltip line below the badge at all", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(xml).not.toContain("Score reflects delivery health");
    expect(xml).not.toContain("{{HEALTH_TOOLTIP}}");
  });

  it("leaves the badge and budget-summary shapes at the template's original, unshifted positions", () => {
    const xml = buildCoverSlideXml(template.cover, BASE_COVER);
    expect(shapeY(xml, "Healthy")).toBe(6119872);
    expect(shapeY(xml, "$100 spent")).toBe(6420192);
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

describe("buildCampaignOrAdSetSlideXml / buildPausedSlideXml — Fix 1: reportType header", () => {
  it("defaults to 'YOUR WEEKLY PERFORMANCE REPORT' when reportType is omitted", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"));
    expect(xml).toContain("YOUR WEEKLY PERFORMANCE REPORT");
    expect(xml).not.toContain("YOUR MONTHLY PERFORMANCE REPORT");
  });

  it("shows 'YOUR WEEKLY PERFORMANCE REPORT' for reportType WEEKLY", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"), undefined, "WEEKLY");
    expect(xml).toContain("YOUR WEEKLY PERFORMANCE REPORT");
  });

  it("shows 'YOUR MONTHLY PERFORMANCE REPORT' for reportType MONTHLY", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"), undefined, "MONTHLY");
    expect(xml).toContain("YOUR MONTHLY PERFORMANCE REPORT");
    expect(xml).not.toContain("YOUR WEEKLY PERFORMANCE REPORT");
  });

  it("keeps the header bold for a Monthly report, matching the Weekly header's own forced bold styling", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"), undefined, "MONTHLY");
    expect(sizeOfRunContaining(xml, "YOUR MONTHLY PERFORMANCE REPORT")).toBeGreaterThan(0);
    const idx = xml.indexOf("<a:t>YOUR MONTHLY PERFORMANCE REPORT</a:t>");
    const runStart = xml.lastIndexOf("<a:r>", idx);
    expect(xml.slice(runStart, idx)).toMatch(/b="1"/);
  });

  it("buildPausedSlideXml shows 'YOUR MONTHLY PERFORMANCE REPORT' for reportType MONTHLY", () => {
    const xml = buildPausedSlideXml(template.campaign, "Acme Inc", "Campaigns paused.", "Jul 13 - Jul 19", "MONTHLY");
    expect(xml).toContain("YOUR MONTHLY PERFORMANCE REPORT");
  });

  it("buildPausedSlideXml defaults to 'YOUR WEEKLY PERFORMANCE REPORT'", () => {
    const xml = buildPausedSlideXml(template.campaign, "Acme Inc", "Campaigns paused.", "Jul 13 - Jul 19");
    expect(xml).toContain("YOUR WEEKLY PERFORMANCE REPORT");
  });
});
