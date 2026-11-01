import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { dailyOptionalMetrics } from "../daily-extra-metrics";
import { buildDayBreakdownShareReportData } from "../share-report";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { renderDayBreakdownPptx } from "../../pptx/render";

const source = parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),CTR (all),CPC (all),Link clicks,Landing page views,Cost per landing page view
Example,2026-10-01,100,5,Website leads,20,100,10,10,10,50,10,10
Second,2026-10-01,200,5,Website leads,30,900,90,10,2.222222,10,30,6.666667
Example,2026-10-02,50,2,Website leads,10,50,10,20,5,0,0,`);
const base = { accountName: "Example", currencySymbol: "$", timezone: "UTC", mtdDailyRows: source.rows, csvHeaders: source.headers, dateRange: { startIso: "2026-10-01", endIso: "2026-10-02" } };
const keys = ["link_clicks", "landing_page_views", "cost_per_lpv"];
describe("daily optional metrics", () => {
  it("offers CSV-backed extras without repeating the daily defaults", () => {
    const available = dailyOptionalMetrics(source.headers).map(metric => metric.key);
    expect(available).toEqual(expect.arrayContaining(keys));
    for (const key of ["spend", "reach", "results", "cost_per_result", "impressions", "ctr", "cpc_all"]) expect(available).not.toContain(key);
  });
  it("uses each day's campaign totals, retains zero and shows missing costs as N/A", () => {
    const data = buildDayBreakdownReportData({ ...base, dailyMetricKeys: [...keys, "made_up", "ctr", "link_clicks"] });
    expect(data.additionalTables).toHaveLength(1);
    const table = data.additionalTables![0];
    const column = (key: string, row: number) => table.rows[row].values[table.metrics.findIndex(metric => metric.key === key)];
    expect(column("link_clicks", 0)).toBe("60");
    expect(column("landing_page_views", 0)).toBe("40");
    expect(column("cost_per_lpv", 0)).toBe("$7.50");
    expect(column("link_clicks", 1)).toBe("0");
    expect(column("cost_per_lpv", 1)).toBe("N/A");
    expect(table.metrics).toHaveLength(3);
    expect(data.dayRows).toEqual(buildDayBreakdownReportData(base).dayRows);
  });
  it("respects campaign selection and carries extras into saved share data", () => {
    const data = buildDayBreakdownReportData({ ...base, selectedCampaigns: ["Example"], dailyMetricKeys: keys });
    const table = data.additionalTables![0];
    expect(table.rows[0].values[table.metrics.findIndex(metric => metric.key === "link_clicks")]).toBe("50");
    const share = buildDayBreakdownShareReportData(data);
    expect(share.dailyAdditionalTables).toEqual(data.additionalTables);
    expect(share.metricGuide.some(metric => metric.term.includes("LANDING"))).toBe(true);
  });
  it("splits wide selections into bounded column groups without losing metrics", () => {
    const extra = { "Post reactions": "1", "Post comments": "2", "Post shares": "3", ThruPlays: "4" };
    const headers = [...source.headers, ...Object.keys(extra)];
    const selected = dailyOptionalMetrics(headers).map(metric => metric.key);
    expect(selected.length).toBeGreaterThan(4);
    const data = buildDayBreakdownReportData({ ...base, csvHeaders: headers, mtdDailyRows: source.rows.map(row => ({ ...row, _raw: { ...row._raw, ...extra } })), dailyMetricKeys: selected });
    expect(data.additionalTables!.every(table => table.metrics.length <= 4)).toBe(true);
    expect(data.additionalTables!.flatMap(table => table.metrics.map(metric => metric.key))).toEqual(selected);
    expect(data.additionalTables!.every(table => table.rows.length === 2)).toBe(true);
  });
  it("keeps old reports compatible without extras", () => {
    expect(buildDayBreakdownReportData(base).additionalTables).toEqual([]);
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("daily extra exports: %s", template => {
  it("paginates days and metric columns, keeps all values and ends with the guide", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ ...source.rows[0], date_start: `2026-10-${String(index + 1).padStart(2, "0")}`, date_end: `2026-10-${String(index + 1).padStart(2, "0")}`, _raw: { ...source.rows[0]._raw, Day: `2026-10-${String(index + 1).padStart(2, "0")}` } }));
    const data = buildDayBreakdownReportData({ ...base, mtdDailyRows: rows, dateRange: { startIso: "2026-10-01", endIso: "2026-10-30" }, dailyMetricKeys: keys });
    expect(data.additionalTables).toHaveLength(4);
    expect(data.additionalTables!.flatMap(table => table.rows)).toHaveLength(30);
    expect(data.additionalTables!.every(table => table.metrics.length <= 4 && table.rows.length <= 8)).toBe(true);
    const buffer = await renderDayBreakdownPptx({ templateBuffer: readFileSync(`templates/${template}`), data, isLightTemplate: template.includes("light") });
    const zip = await JSZip.loadAsync(buffer);
    const paths = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a,b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
    const slides = await Promise.all(paths.map(path => zip.file(path)!.async("string")));
    expect(slides).toHaveLength(10);
    expect(slides.filter(xml => xml.includes("ADDITIONAL DAILY METRICS"))).toHaveLength(4);
    expect(slides.join("\n")).toContain("Oct 30, 2026");
    expect(slides.at(-1)).toContain("METRIC ABBREVIATION GUIDE");
    expect(slides.join("\n")).not.toContain("{{");
  }, 30_000);
});
