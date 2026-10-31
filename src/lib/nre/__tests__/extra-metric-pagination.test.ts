import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { splitMetricsForSlides, type SelectedMetric } from "../available-metrics";
import { metricSlideSizes, MAX_TOTAL_METRICS } from "../metric-pagination";
import { buildReportData } from "../report-data";
import { adSetKey } from "../ad-sets";
import { parseCsvText } from "../parse-csv";
import { regeneratePptxFromShare } from "../regenerate-report";
import { buildShareReportData, buildHistoricalShareReportData } from "../share-report";
import { applyShareEditsToReportData } from "../apply-share-edits";
import { buildHistoricalReportData } from "../historical-report-data";
import { selectedMetricsSchema, campaignMetricOverridesSchema } from "@/lib/validators/report-wizard";
import { renderPptx, renderHistoricalPptx } from "../../pptx/render";
import { additionalMetricPages } from "../../pptx/additional-metrics-slide";

const basics: SelectedMetric[] = [
  ["spend", "Amount spent (USD)", "currency"], ["reach", "Reach", "number"], ["impressions", "Impressions", "number"],
  ["results", "Results", "number"], ["cost_per_result", "Cost per result", "currency"], ["ctr", "CTR (all)", "percentage"],
  ["link_clicks", "Link clicks", "number"], ["landing_page_views", "Landing page views", "number"],
].map(([key, csvName, format]) => ({ key, label: key.toUpperCase(), csvName, format } as SelectedMetric));
function selection(count: number) {
  return [...basics, ...Array.from({ length: Math.max(0, count - 8) }, (_, i) => ({ key: `extra_${i}`, label: `EXTRA METRIC ${i + 1}`, csvName: `Extra ${i + 1}`, format: "number" as const }))].slice(0, count);
}
function fixture(count: number) {
  const selectedMetrics = selection(count);
  const headers = "Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,CTR (all),Link clicks,Landing page views," + selectedMetrics.slice(8).map(m => m.csvName).join(",");
  const csv = [headers, ...Array.from({ length: 31 }, (_, i) => `Example,Example set,2026-08-${String(i + 1).padStart(2, "0")},10,2,Website leads,100,1000,2,20,15,${selectedMetrics.slice(8).map((_, j) => j + 1).join(",")}`)].join("\n");
  const rows = parseCsvText(csv).rows;
  const input = { accountName: "Example account", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now: new Date("2026-09-01T12:00:00Z"), weeklyRange: { startIso: "2026-08-25", endIso: "2026-08-31" }, selectedMetrics, selectedAdSets: [adSetKey("Example", "Example set")], campaignMetricOverrides: { Example: selectedMetrics.map(m => m.key) } };
  return { input, data: buildReportData(input) };
}
async function slides(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Promise.all(Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).map(p => zip.file(p)!.async("string")));
}

describe("extra metric selection and preservation", () => {
  it.each([[8,[8]], [9,[8,1]], [11,[8,3]], [16,[8,8]], [17,[8,5,4]], [20,[8,6,6]], [25,[8,6,6,5]], [64,[8,8,8,8,8,8,8,8]]])("%i metrics get balanced pages %j", (count, sizes) => {
    const selected = selection(count as number);
    const pages = splitMetricsForSlides(selected);
    expect(pages.map(page => page.length)).toEqual(sizes);
    expect(metricSlideSizes(count as number)).toEqual(sizes);
    expect(pages.flat()).toEqual(selected);
  });
  it("retains all 20 selected CSV metrics on campaigns, ad sets, sharing and re-download edits", () => {
    const { data } = fixture(20);
    for (const slide of [...data.campaignSlides, ...data.adSetSlides]) {
      expect(slide.dynamicMetrics).toHaveLength(8);
      expect(slide.additionalMetricsSlide).toHaveLength(12);
      expect(slide.additionalMetricsSlide![11]?.value).toBe("84"); // 12 per day × 7 days.
    }
    const share = buildShareReportData(data, new Map());
    expect(share.campaigns[0].metrics).toHaveLength(20);
    expect(share.adSets[0].metrics).toHaveLength(20);
    share.campaigns[0].metrics[19].value = "123";
    const edited = applyShareEditsToReportData(data, share);
    expect(edited.campaignSlides[0].additionalMetricsSlide![11]?.value).toBe("123");
  });
  it("accepts an account-wide metric union larger than one campaign's cap, while bounding each override", () => {
    expect(selectedMetricsSchema.safeParse([...selection(64), ...selection(64).map(m => ({ ...m, key: `other_${m.key}` }))]).success).toBe(true);
    expect(campaignMetricOverridesSchema.safeParse({ Example: selection(64).map(m => m.key) }).success).toBe(true);
    expect(campaignMetricOverridesSchema.safeParse({ Example: Array.from({ length: MAX_TOTAL_METRICS + 1 }, (_, i) => `m${i}`) }).success).toBe(false);
  });
  it("removes old archived result/cost filler when building continuation pages", () => {
    const { data } = fixture(9);
    const slide = data.campaignSlides[0];
    slide.additionalMetricsSlide!.push(slide.dynamicMetrics[3], slide.dynamicMetrics[4]);
    expect(additionalMetricPages(slide).flat().map(m => m.key)).toEqual(["extra_0"]);
    expect(buildShareReportData(data, new Map()).campaigns[0].metrics).toHaveLength(9);
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("adaptive cards in actual %s PPTX", template => {
  const options = { templateBuffer: readFileSync(resolve(process.cwd(), "templates", template)), currencySymbol: "$", isLightTemplate: template.includes("light") };
  it.each([9, 11, 17, 20, 64])("renders every selected card exactly once on extra pages for %i metrics", async count => {
    const { data } = fixture(count);
    const output = await slides(await renderPptx({ ...options, data }));
    const extras = output.filter(xml => xml.includes(">ADDITIONAL METRICS<"));
    expect(extras).toHaveLength((metricSlideSizes(count).length - 1) * 2); // Campaign and ad set.
    const text = extras.join("\n");
    for (const metric of selection(count).slice(8)) expect(text.split(`>${metric.label}<`).length - 1).toBe(2);
    expect(text).not.toMatch(/>RESULTS<|>COST_PER_RESULT<|>CAMPAIGN SUMMARY<|>KEY INSIGHTS/);
    expect(text).not.toContain(">—<");
    expect(text).not.toContain("{{");
    for (const xml of extras) {
      const cards = [...xml.matchAll(/name="Card /g)].length;
      expect(cards).toBeGreaterThan(0);
      expect(cards).toBeLessThanOrEqual(8);
      // Native, editable card shapes stay inside the 960 × 540 point canvas.
      for (const match of xml.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
        expect((Number(match[1]) + Number(match[3])) / 12700).toBeLessThanOrEqual(961);
        expect((Number(match[2]) + Number(match[4])) / 12700).toBeLessThanOrEqual(541);
      }
    }
  }, 60_000);
  it("keeps more than 16 metrics on historical month-total slides too", async () => {
    const { input } = fixture(20);
    const data = buildHistoricalReportData({ ...input, mtdDailyRows: [...input.mtdDailyRows, ...input.mtdDailyRows.map(row => ({ ...row, campaign_name: "Second campaign" }))], monthCount: 1 });
    const total = data.slides.find(slide => slide.isMonthTotal)!;
    expect(total.additionalMetricsSlide).toHaveLength(12);
    const output = await slides(await renderHistoricalPptx({ ...options, data }));
    expect(output.filter(xml => xml.includes(">ADDITIONAL METRICS<") && xml.includes("ALL CAMPAIGNS TOTAL"))).toHaveLength(2);
    const share = buildHistoricalShareReportData(data, new Map());
    const totalShare = share.campaigns.find(campaign => campaign.campaignName.includes("ALL CAMPAIGNS TOTAL"))!;
    expect(totalShare.metrics).toHaveLength(20);
    totalShare.metrics.find(metric => metric.key === "extra_11")!.value = "9,876,543";
    const regenerated = await slides(await regeneratePptxFromShare({ ...share, _renderArchive: { historicalData: data, isLightTemplate: options.isLightTemplate } }, options.templateBuffer));
    expect(regenerated.filter(xml => xml.includes(">ADDITIONAL METRICS<")).join("\n")).toContain(">9,876,543<");
  }, 60_000);
});
