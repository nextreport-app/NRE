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
    dynamicMetrics: [],
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

describe("buildCampaignOrAdSetSlideXml — Google Ads metric card retexting", () => {
  it("keeps Meta's own card labels by default (platform omitted)", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Purchases"));
    expect(xml).toContain("AD SPEND");
    expect(xml).toContain("REACH");
    expect(xml).toContain("CPC (All)");
    expect(xml).not.toContain("AVG. CPC (All)");
  });

  it("retexts AD SPEND/REACH/CPC (All) to Google Ads wording when platform is GOOGLE, leaving IMPRESSIONS untouched", () => {
    const xml = buildCampaignOrAdSetSlideXml(
      template.campaign,
      makeCampaignSlide("Shoes - Search"),
      undefined,
      "WEEKLY",
      "GOOGLE",
    );
    expect(xml).toContain("COST");
    expect(xml).not.toContain(">AD SPEND<");
    expect(xml).toContain("CLICKS");
    expect(xml).not.toContain(">REACH<");
    expect(xml).toContain("AVG. CPC (All)");
    expect(xml).toContain("IMPRESSIONS");
  });

  it("uses '(Ad Group)' instead of '(Ad Set)' for a Google Ads ad-set-kind slide", () => {
    const { avgFreq: _avgFreq, ...rest } = makeCampaignSlide("Shoes - Search");
    const googleAdGroupSlide = { ...rest, kind: "adset" as const, adSetName: "Prospecting", rowFreq: 0 };
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, googleAdGroupSlide, undefined, "WEEKLY", "GOOGLE");
    expect(xml).toContain("Prospecting (Ad Group)");
    expect(xml).not.toContain("(Ad Set)");
  });
});

// A full 7-slot assignment matching the template's own physical slot order
// (Spend/Reach/Impressions/Results/CTR/Cost per Result/CPC) — the shape
// every real wizard-driven render sends.
function sevenSlotMetrics() {
  return [
    { key: "spend", label: "AD SPEND", format: "currency" as const, value: "$4,521", type: "primary" as const },
    { key: "reach", label: "REACH", format: "number" as const, value: "128,400", type: "primary" as const },
    { key: "impressions", label: "IMPRESSIONS", format: "number" as const, value: "310,900", type: "primary" as const },
    { key: "website_leads", label: "WEBSITE LEADS", format: "number" as const, value: "88", type: "secondary" as const },
    { key: "cost_per_lead", label: "COST PER LEAD", format: "currency" as const, value: "$12.50", type: "secondary" as const, perUnitOf: "website_leads" },
    { key: "ctr", label: "CTR (ALL)", format: "percentage" as const, value: "2.10%", type: "primary" as const },
    { key: "cpc_all", label: "CPC (ALL)", format: "currency" as const, value: "$0.85", type: "secondary" as const, perUnitOf: "clicks_all" },
  ];
}

describe("buildCampaignOrAdSetSlideXml — dynamic metric dictionary system (7-slot template retext, Step 1-3/7)", () => {
  it("uses the fixed 7-field card tags when dynamicMetrics is absent (default makeCampaignSlide fixture)", () => {
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Search"));
    expect(xml).toContain("$100");
    expect(xml).toContain("1,000");
    // The template's own static "AD SPEND"/"REACH" card labels are untouched.
    expect(xml).toContain("AD SPEND");
    expect(xml).toContain("REACH");
  });

  it("retexts the template's own 7 fixed card slots in place — no shapes added or removed — when dynamicMetrics is present", () => {
    const slide = { ...makeCampaignSlide("Shoes - Search"), dynamicMetrics: sevenSlotMetrics() };
    const before = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Search"));
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, slide);

    expect(xml).toContain("$4,521");
    expect(xml).toContain("128,400");
    expect(xml).toContain("WEBSITE LEADS");
    expect(xml).toContain("88");
    expect(xml).toContain("COST PER LEAD");
    expect(xml).toContain("$12.50");
    // The old fixed-card values from the slide's `metrics` field never
    // render on the dynamic path.
    expect(xml).not.toContain("$100");
    expect(xml).not.toContain(">1,000<");

    // Same total shape count as the non-dynamic render of the same
    // template — this path only ever retexts/re-icons existing shapes, it
    // never inserts or strips any (Step 1: no more from-scratch card
    // generation, no more removeShapeContaining for cards).
    const shapeCount = (xml: string) => (xml.match(/<p:sp>/g) || []).length + (xml.match(/<p:grpSp>/g) || []).length + (xml.match(/<p:pic>/g) || []).length;
    expect(shapeCount(xml)).toBe(shapeCount(before));
  });

  it("swaps a slot's icon relationship id when the assigned metric's icon category differs from that slot's own native template icon (Step 3)", () => {
    // Slot 4 (physically the RESULTS card, native icon = "results") is
    // assigned "impressions" here instead — its icon should end up
    // pointing at the SAME relationship id slot 3 (the real IMPRESSIONS
    // card) natively uses, not the RESULTS card's own native icon.
    const withoutSwap = makeCampaignSlide("Shoes - Search");
    const baseline = buildCampaignOrAdSetSlideXml(template.campaign, withoutSwap);
    const impressionsCardIconRelId = [...baseline.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])[2]; // 3rd icon = slot 3 = Impressions

    const slots = sevenSlotMetrics();
    slots[3] = { key: "impressions", label: "IMPRESSIONS", format: "number" as const, value: "999,000", type: "primary" as const };
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, { ...withoutSwap, dynamicMetrics: slots });

    const resultsSlotIconRelId = [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])[3]; // 4th icon = slot 4 = Results (now showing Impressions)
    expect(resultsSlotIconRelId).toBe(impressionsCardIconRelId);
  });

  it("keeps a slot's own native icon when the assigned metric already matches that slot's default category", () => {
    const slide = { ...makeCampaignSlide("Shoes - Search"), dynamicMetrics: sevenSlotMetrics() };
    const baseline = buildCampaignOrAdSetSlideXml(template.campaign, makeCampaignSlide("Shoes - Search"));
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, slide);
    // Slot 1 stays "spend" in both — its icon relationship id shouldn't change.
    const relIdsOf = (x: string) => [...x.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1]);
    expect(relIdsOf(xml)[0]).toBe(relIdsOf(baseline)[0]);
  });

  it("still fills DATE_RANGE/CAMPAIGN_SUMMARY/KEY_INSIGHTS (the untouched AI-copy column) on the dynamic path", () => {
    const slide = { ...makeCampaignSlide("Shoes - Search"), dynamicMetrics: sevenSlotMetrics() };
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, slide, { summary: "A real summary.", insights: "Real insights." });
    expect(xml).toContain("A real summary.");
    expect(xml).toContain("Real insights.");
    expect(xml).toContain("Jul 13 - Jul 19");
  });

  it("produces well-formed XML (balanced shape tags) on the dynamic path", () => {
    const slide = { ...makeCampaignSlide("Shoes - Search"), dynamicMetrics: sevenSlotMetrics() };
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, slide);
    const openSp = (xml.match(/<p:sp>/g) || []).length;
    const closeSp = (xml.match(/<\/p:sp>/g) || []).length;
    const openGrp = (xml.match(/<p:grpSp>/g) || []).length;
    const closeGrp = (xml.match(/<\/p:grpSp>/g) || []).length;
    expect(openSp).toBe(closeSp);
    expect(openGrp).toBe(closeGrp);
  });

  it("fills a shorter-than-7 assignment's remaining slots with a dash rather than leaving a raw {{TAG}} visible (defensive)", () => {
    const slide = { ...makeCampaignSlide("Shoes - Search"), dynamicMetrics: sevenSlotMetrics().slice(0, 3) };
    const xml = buildCampaignOrAdSetSlideXml(template.campaign, slide);
    expect(xml).not.toContain("{{METRIC_");
    expect(xml).toContain("—");
  });
});
