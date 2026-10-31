import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import { parseCsvText } from "../parse-csv";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { buildHistoricalReportData } from "../historical-report-data";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { buildComparisonReportData, buildReportData } from "../report-data";
import { renderPptx, renderHistoricalPptx, renderDayBreakdownPptx, renderComparisonPptx } from "../../pptx/render";
import { validateMtdDailyCsv } from "../validate";
import type { SelectedMetric } from "../available-metrics";
import { buildVisualChartTitle } from "../visual-chart-slide";
import { adSetKey } from "../ad-sets";
import { buildHistoricalAiCopyMap } from "../historical-report-data";
import { buildHistoricalShareReportData } from "../share-report";
import { regeneratePptxFromShare } from "../regenerate-report";

const client = { id: "contract", userId: "contract", accountName: "Output contract", currency: "USD", timezone: "UTC", monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
const dates = Array.from({ length: 92 }, (_, i) => new Date(Date.UTC(2025, 6, 1 + i)).toISOString().slice(0, 10));
const parsed = parseCsvText(`Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Impressions,Reach,Link clicks,Clicks (all)\n${dates.map(day => `Example campaign,Example ad set,${day},10,2,Website leads,1000,500,20,40`).join("\n")}`);
const base = { accountName: client.accountName, currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: parsed.rows, now: new Date("2025-10-10T12:00:00Z") };
async function texts(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Promise.all(Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a,b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1])).map(async p => {
    const xml = await zip.file(p)!.async("string");
    expect(xml).not.toMatch(/\{\{[A-Z_]+\}\}/);
    return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]).join(" | ");
  }));
}

describe.each(["dark.pptx", "meta-ads-light.pptx"])("report scopes survive actual %s output", template => {
  const templateBuffer = readFileSync(resolve(process.cwd(), "templates", template));
  const theme = { templateBuffer, isLightTemplate: template.includes("light") };
  it("honours selected ad sets for every month and charts each month's own window", async () => {
    const input = { ...base, monthCount: 3 };
    const selected = buildHistoricalReportData({ ...input, selectedAdSets: [adSetKey("Example campaign", "Example ad set")] });
    const unselected = buildHistoricalReportData({ ...input, selectedAdSets: [] });
    expect(selected.adSetSlides).toHaveLength(3);
    expect(unselected.adSetSlides).toHaveLength(0);
    expect(selected.comparisonRows).toEqual(unselected.comparisonRows);
    expect(selected.monthlyCharts?.map(item => item.chart.totalAllSpend)).toEqual([310, 310, 300]);
    expect(selected.monthlyCharts?.map(item => item.chart.actualPeriodDays)).toEqual([31, 31, 30]);
    const output = await texts(await renderHistoricalPptx({ ...theme, data: selected, aiCopyBySlideKey: buildHistoricalAiCopyMap(selected.slides, selected.adSetSlides) }));
    expect(output.filter(slide => slide.includes("Example ad set") && slide.includes("AD SPEND"))).toHaveLength(3);
    expect(output.filter(slide => slide.includes("SPEND BY OBJECTIVE"))).toHaveLength(3);
    expect(output.join("\n")).not.toMatch(/Last 30 Days|WEEKLY PERFORMANCE/);
    expect(output.at(-1)).toContain("METRIC ABBREVIATION GUIDE");
    const share = buildHistoricalShareReportData(selected, buildHistoricalAiCopyMap(selected.slides, selected.adSetSlides));
    expect(share.adSets).toHaveLength(3);
    expect(new Set(share.adSets.map(item => item.campaignName)).size).toBe(3);
    const regenerated = await texts(await regeneratePptxFromShare({ ...share, _renderArchive: { historicalData: selected, isLightTemplate: theme.isLightTemplate } }, templateBuffer));
    expect(regenerated.filter(slide => slide.includes("Example ad set") && slide.includes("AD SPEND"))).toHaveLength(3);
    expect(regenerated.filter(slide => slide.includes("SPEND BY OBJECTIVE"))).toHaveLength(3);
  }, 30_000);
  it("renders monthly-total CSV facts without weekly periods or fabricated daily charts", async () => {
    const source = parseCsvText("Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Results,Result type,Reach,Impressions\nExample,2026-09-01,2026-09-30,300,6,Website leads,1000,9000");
    expect(validateMtdDailyCsv(source.colMap, source.rows, new Date("2026-10-29T12:00:00Z"), source.headers, "META", undefined, "MONTHLY").valid).toBe(true);
    const formData = new FormData();
    formData.set("reportType", JSON.stringify("MONTHLY"));
    formData.set("dateSelection", JSON.stringify({ mode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" }));
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: source, formData, now: new Date("2026-10-29T12:00:00Z") });
    if (!("data" in result)) throw new Error(result.error);
    const output = (await texts(await renderPptx({ ...theme, data: result.data, currencySymbol: "$" }))).join("\n");
    expect(output).toContain("YOUR MONTHLY PERFORMANCE REPORT");
    expect(output).toContain("$300");
    expect(output).not.toMatch(/WEEKLY PERFORMANCE|Last 30 Days/);
  }, 30_000);
  it("weekly retains its distinct week cards, monthly totals and rolling chart", async () => {
    const data = buildReportData({ ...base, reportType: "WEEKLY", now: new Date("2025-10-01T12:00:00Z"), weeklyRange: { startIso: "2025-09-24", endIso: "2025-09-30" } });
    expect(data.campaignSlides[0].metrics.spend).toBe("$70");
    expect(data.mtdRow.spend).toBe("$300");
    expect(data.chart!.totalAllSpend).toBe(300);
    const output = await texts(await renderPptx({ ...theme, data, currencySymbol: "$" }));
    expect(output.join("\n")).toContain("YOUR WEEKLY PERFORMANCE REPORT");
    expect(output.join("\n")).toContain("Last 30 Days");
  }, 30_000);
  it.each([
    { type: "MONTHLY", start: "2025-09-01", end: "2025-09-30", spend: "$300", heading: "YOUR MONTHLY PERFORMANCE REPORT" },
    { type: "MONTHLY", start: "2025-08-01", end: "2025-08-31", spend: "$310", heading: "YOUR MONTHLY PERFORMANCE REPORT" },
    { type: "DAILY", start: "2025-09-14", end: "2025-09-14", spend: "$10", heading: "YOUR SINGLE-DAY PERFORMANCE REPORT" },
  ])("$type $start excludes other periods from cards, chart and totals", async ({ type, start, end, spend, heading }) => {
    const formData = new FormData();
    formData.set("reportType", JSON.stringify(type));
    formData.set("dateSelection", JSON.stringify({ mode: "custom", customStart: start, customEnd: end }));
    formData.set("includePreviousMonthComparison", "true");
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData });
    if (!("data" in result)) throw new Error(result.error);
    const data = result.data;
    expect(data.mtdRow.spend).toBe(spend);
    expect(data.periodRow.hasData).toBe(false);
    expect(data.chart!.totalAllSpend).toBe(Number(spend.slice(1)));
    expect(buildVisualChartTitle(data.chart!)).not.toMatch(/Last 30/);
    expect(data.campaignSlides[0].metrics.spend).toBe(spend);
    const output = await texts(await renderPptx({ ...theme, data, currencySymbol: "$" }));
    const joined = output.join("\n");
    expect(output.at(-1)).toMatch(/METRIC ABBREVIATION GUIDE/i);
    expect(joined).toContain(heading);
    expect(joined).not.toMatch(/WEEKLY PERFORMANCE|YESTERDAY PERFORMANCE|Last 30 Days/);
    if (type === "DAILY") {
      expect(joined).not.toContain("MONTHLY CAMPAIGN PERFORMANCE OVERVIEW");
      expect(joined).toContain("Date");
    }
  }, 30_000);
  it("keeps overflow chips on monthly total continuation slides", async () => {
    const selectedMetrics: SelectedMetric[] = ["spend", "reach", "impressions", "results", "ctr", "cpc", "link_clicks", "cpm", "frequency"].map(key => ({ key, label: key.toUpperCase(), format: "number", csvName: key }));
    const data = buildHistoricalReportData({ ...base, mtdDailyRows: [...base.mtdDailyRows, ...base.mtdDailyRows.map(row => ({ ...row, campaign_name: "Second campaign" }))], monthCount: 3, selectedMetrics });
    const totals = data.slides.filter(s => s.isMonthTotal);
    expect(totals).toHaveLength(3);
    for (const total of totals) expect(total.additionalMetricsSlide?.filter(Boolean).map(m => m!.key)).toEqual(["frequency"]);
    const output = await texts(await renderHistoricalPptx({ ...theme, data }));
    expect(output.filter(t => t.includes("ALL CAMPAIGNS TOTAL") && t.includes("FREQUENCY"))).toHaveLength(3);
  }, 30_000);
  it("month-by-month contains separate month cards/totals and overview, without a rolling chart", async () => {
    const data = buildHistoricalReportData({ ...base, monthCount: 3 });
    expect(data.comparisonRows.map(r => r.spend)).toEqual(["$310", "$310", "$300"]);
    const output = await texts(await renderHistoricalPptx({ ...theme, data }));
    expect(output.join("\n")).not.toMatch(/WEEKLY PERFORMANCE|Last 30 Days|YESTERDAY PERFORMANCE/);
    expect(output.at(-2)).toContain("MULTI-MONTH PERFORMANCE OVERVIEW");
    expect(output.at(-1)).toMatch(/METRIC ABBREVIATION GUIDE/i);
    for (const month of ["JULY", "AUGUST", "SEPTEMBER"]) expect(output.join("\n")).toContain(`YOUR ${month} PERFORMANCE REPORT`);
  }, 30_000);
  it("day-by-day output is tables only, with a row per selected day", async () => {
    const data = buildDayBreakdownReportData({ ...base, dateRange: { startIso: "2025-09-01", endIso: "2025-09-10" } });
    expect(data.dayRows).toHaveLength(10);
    const output = await texts(await renderDayBreakdownPptx({ ...theme, data }));
    expect(output).toHaveLength(2 + data.tableSlides.length);
    expect(output.at(-1)).toMatch(/METRIC ABBREVIATION GUIDE/i);
    expect(output.join("\n")).not.toMatch(/MONTHLY CAMPAIGN|WEEKLY PERFORMANCE|Last 30 Days/);
    expect(output[1]).toContain("Date");
  }, 30_000);
  it.each([
    ["2025-09-01", "2025-09-07", "2025-08-01", "2025-08-07", "$70"],
    ["2025-09-01", "2025-09-30", "2025-08-01", "2025-08-31", "$300"],
  ])("comparison supports %s–%s against %s–%s", async (aStart, aEnd, bStart, bEnd, spend) => {
    const data = buildComparisonReportData({ ...base, periodA: { startIso: aStart, endIso: aEnd }, periodB: { startIso: bStart, endIso: bEnd } });
    const output = await texts(await renderComparisonPptx({ ...theme, data }));
    expect(output.join("\n")).toContain(spend);
    expect(output).toHaveLength(4); // Cover, campaign comparison, summary, guide.
    expect(output.at(-1)).toMatch(/METRIC ABBREVIATION GUIDE/i);
    expect(output.join("\n")).not.toMatch(/MONTHLY CAMPAIGN|WEEKLY PERFORMANCE|Last 30 Days/);
  }, 30_000);
});

describe("CSV input grain contract", () => {
  it("rejects month totals rather than treating the start date as a daily observation", () => {
    const monthly = parseCsvText("Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Results,Result type\nCampaign,2025-09-01,2025-09-30,300,60,Website leads");
    const validation = validateMtdDailyCsv(monthly.colMap, monthly.rows, base.now, monthly.headers);
    expect(validation.errors).toContainEqual(expect.objectContaining({ field: "date_granularity" }));
  });
});
