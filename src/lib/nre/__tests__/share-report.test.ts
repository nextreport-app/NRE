import { describe, expect, it, beforeAll } from "vitest";
import { buildReportData } from "../report-data";
import { buildShareReportData } from "../share-report";
import { slideAiKey } from "../../pptx/render";
import type { NreRow } from "../columns";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-07-20T12:00:00Z");

function daysInclusive(startDay: number, endDay: number): string[] {
  const days: string[] = [];
  for (let d = startDay; d <= endDay; d++) days.push(`${String(d).padStart(2, "0")}-07-2026`);
  return days;
}

function buildDailyRowsForAdSet(campaignName: string, adSetName: string): NreRow[] {
  return daysInclusive(13, 19).map((day) => ({
    _raw: { Day: day },
    campaign_name: campaignName,
    ad_set_name: adSetName,
    result_type: "Purchase",
    spend: "100",
    reach: "1000",
    impressions: "3000",
    results: "2",
    link_clicks: "50",
    ctr: "1.5",
    cpc: "3",
    frequency: "3",
    date_start: day,
    date_end: day,
  }));
}

function buildDailyRows(campaignName: string): NreRow[] {
  return buildDailyRowsForAdSet(campaignName, "Prospecting");
}

describe("buildShareReportData", () => {
  const mtdDailyRows = buildDailyRows("Shoes - Purchases");
  const data = buildReportData({
    accountName: "Test Agency",
    currencySymbol: "₹",
    timezone: "Asia/Kolkata",
    monthlyBudget: 100000,
    mtdDailyRows,
    now: NOW,
  });

  const aiCopy = new Map([[slideAiKey(data.campaignSlides[0]), { summary: "Great week.", insights: "Keep scaling." }]]);
  const share = buildShareReportData(data, aiCopy, new Date("2026-07-20T18:00:00Z"), { currencySymbol: "₹" });

  it("carries version, account, report type, and generatedAt", () => {
    expect(share.version).toBe(1);
    expect(share.accountName).toBe("Test Agency");
    expect(share.reportType).toBe("WEEKLY");
    expect(share.generatedAt).toBe("2026-07-20T18:00:00.000Z");
  });

  it("mirrors the cover slide's data exactly", () => {
    expect(share.cover.dateRange).toBe(data.cover.dateRange);
    expect(share.cover.healthScore).toBe(data.cover.healthScore);
    expect(share.cover.healthBadge).toBe(data.cover.healthBadge);
    expect(share.cover.budgetSummary).toBe(data.cover.budgetSummary);
  });

  it("builds one campaign entry per campaign slide, with its own dynamic metrics (nulls dropped) and matched AI copy", () => {
    expect(share.campaigns).toHaveLength(1);
    const c = share.campaigns[0];
    expect(c.campaignName).toBe("Shoes - Purchases");
    // This fixture's CSV has no extra dictionary columns at all (only Day
    // in _raw), so slots 7/8 (Round I: no metric shown unless the CSV
    // genuinely backs it) are null — dropped from the share page's own
    // metric list rather than threaded through as empty cards.
    const realDynamicMetrics = data.campaignSlides[0].dynamicMetrics.filter((m) => m !== null);
    expect(c.metrics).toHaveLength(realDynamicMetrics.length);
    expect(c.metrics).toEqual(realDynamicMetrics);
    expect(c.aiSummary).toBe("Great week.");
    expect(c.aiInsights).toBe("Keep scaling.");
  });

  it("falls back to empty AI copy when a slide has no matching entry in the map", () => {
    const shareNoAi = buildShareReportData(data, new Map());
    expect(shareNoAi.campaigns[0].aiSummary).toBe("");
    expect(shareNoAi.campaigns[0].aiInsights).toBe("");
  });

  it("carries the Combined Total table rows and header labels unchanged", () => {
    expect(share.periodRow).toBe(data.periodRow);
    expect(share.mtdRow).toBe(data.mtdRow);
    expect(share.tableHeaderLabels).toBe(data.tableHeaderLabels);
  });

  it("builds one ad-set entry per ad-set slide (Round J)", () => {
    // A campaign with only one ad set has no separate ad-set slide (the
    // campaign slide already covers it — see report-data.ts) so this needs
    // its own two-ad-set fixture to exercise the projection at all.
    const twoAdSetRows = [
      ...buildDailyRowsForAdSet("Shoes - Purchases", "Prospecting"),
      ...buildDailyRowsForAdSet("Shoes - Purchases", "Retargeting"),
    ];
    const twoAdSetData = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: twoAdSetRows,
      now: NOW,
    });
    expect(twoAdSetData.adSetSlides.length).toBeGreaterThan(0);
    const twoAdSetShare = buildShareReportData(twoAdSetData, new Map(), NOW, { currencySymbol: "₹" });
    expect(twoAdSetShare.adSets).toHaveLength(twoAdSetData.adSetSlides.length);
    const a = twoAdSetShare.adSets[0];
    expect(a.campaignName).toBe("Shoes - Purchases");
    expect(["Prospecting", "Retargeting"]).toContain(a.adSetName);
    const realDynamicMetrics = twoAdSetData.adSetSlides[0].dynamicMetrics.filter((m) => m !== null);
    expect(a.metrics).toEqual(realDynamicMetrics);
  });

  it("projects the MTD visual chart with budget + result panels", () => {
    expect(data.chart).not.toBeNull();
    expect(share.chart).not.toBeNull();
    expect(share.chart!.title).toContain("Campaign Performance");
    expect(share.chart!.visualSlide).toBeTruthy();
    expect(share.chart!.visualSlide!.leftHeading).toBe("BUDGET DISTRIBUTION");
    expect(share.chart!.snapshot.mtdSpendLabel).toContain("₹");
    expect(share.chart!.donutSegments.length).toBeGreaterThan(0);
    expect(share.chart!.donutSegments[0]?.color).toBe("f6ad55");
  });

  it("includes default visibility flags for the pre-share editor", () => {
    expect(share.visibility?.overview).toBe(true);
    expect(share.visibility?.campaigns["Shoes - Purchases"]).toBe(true);
    expect(share.publishedAt).toBeNull();
  });

  it("rollup donut includes every campaign with MTD spend (top slices + Other)", () => {
    const sixCampaignRows = [
      ...buildDailyRows("Campaign A"),
      ...buildDailyRows("Campaign B"),
      ...buildDailyRows("Campaign C"),
      ...buildDailyRows("Campaign D"),
      ...buildDailyRows("Campaign E"),
      ...buildDailyRows("Campaign F"),
    ];
    const sixData = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: sixCampaignRows,
      now: NOW,
    });
    const sixShare = buildShareReportData(sixData, new Map(), NOW, { currencySymbol: "₹" });
    expect(sixData.chart!.campaigns.length).toBe(6);
    expect(sixShare.chart!.donutSegments.length).toBe(6);
    expect(sixShare.chart!.donutSegments.some((s) => s.name === "Other")).toBe(true);
  });

  it("collects the same Metric Guide entries the PPT legend slide would show (spend excluded, deduped)", () => {
    expect(share.metricGuide.every((e) => e.term.toUpperCase() !== "AD SPEND")).toBe(true);
    const terms = share.metricGuide.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("threads agencyName through from extras, defaulting to null", () => {
    expect(share.agencyName).toBeNull();
    const withAgency = buildShareReportData(data, aiCopy, NOW, { agencyName: "Acme Agency" });
    expect(withAgency.agencyName).toBe("Acme Agency");
  });

  it("defaults chart total spend formatting to '$' when no currencySymbol is passed", () => {
    const noCurrency = buildShareReportData(data, aiCopy, NOW);
    expect(noCurrency.chart!.totalSpendLabel.startsWith("$")).toBe(true);
  });

  it("only includes campaign slides, never leaks ad-set data into the campaigns array", () => {
    // Two ad sets under the same campaign would otherwise produce ad-set
    // slides too — confirm the share payload doesn't leak them in.
    const multiAdSetRows = [...buildDailyRows("Shoes - Purchases"), ...buildDailyRows("Shoes - Purchases")];
    const multiData = buildReportData({
      accountName: "Test Agency",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      monthlyBudget: 100000,
      mtdDailyRows: multiAdSetRows,
      now: NOW,
    });
    const multiShare = buildShareReportData(multiData, new Map());
    expect(multiShare.campaigns).toHaveLength(multiData.campaignSlides.length);
    expect(multiShare.adSets).toHaveLength(multiData.adSetSlides.length);
  });
});
