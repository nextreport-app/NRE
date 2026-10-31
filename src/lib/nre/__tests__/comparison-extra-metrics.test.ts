import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildComparisonReportData } from "../report-data";
import { comparisonOptionalMetrics } from "../comparison-extra-metrics";

const source = parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),CTR (all),CPC (all),Link clicks,Landing page views,Cost per landing page view
Example,2026-10-01,100,5,Website leads,20,100,10,10,10,50,10,10
Example,2026-10-02,200,5,Website leads,30,900,90,10,2.222222,10,30,6.666667
Example,2026-09-01,50,2,Website leads,10,50,10,20,5,0,0,
Example,2026-09-02,50,2,Website leads,10,150,10,6.666667,5,0,0,`);
const base = { accountName: "Example", currencySymbol: "$", timezone: "UTC", mtdDailyRows: source.rows, csvHeaders: source.headers, periodA: { startIso: "2026-10-01", endIso: "2026-10-02" }, periodB: { startIso: "2026-09-01", endIso: "2026-09-02" } };

describe("optional comparison metrics", () => {
  it("lists exported numeric metrics, excluding defaults and unrecognised columns", () => {
    const keys = comparisonOptionalMetrics([...source.headers, "Client secret", "Unknown metric"], "META").map(metric => metric.key);
    expect(keys).toEqual(expect.arrayContaining(["impressions", "ctr", "cpc_all", "link_clicks", "landing_page_views", "cost_per_lpv"]));
    for (const key of ["spend", "reach", "results", "cost_per_result"]) expect(keys).not.toContain(key);
  });
  it("uses period totals and weighted rates rather than averaging daily rates", () => {
    const report = buildComparisonReportData({ ...base, comparisonMetricKeys: ["impressions", "ctr", "cpc_all", "link_clicks", "landing_page_views", "cost_per_lpv"] });
    const extras = new Map(report.campaigns[0].additionalMetrics!.map(metric => [metric.key, metric]));
    expect(extras.get("impressions")).toMatchObject({ valueA: 1000, valueB: 200, percent: 400 });
    expect(extras.get("ctr")!.valueA).toBeCloseTo(10);
    expect(extras.get("ctr")!.valueB).toBeCloseTo(10);
    expect(extras.get("cpc_all")!.valueA).toBeCloseTo(3);
    expect(extras.get("cpc_all")!.valueB).toBeCloseTo(5);
    expect(extras.get("cost_per_lpv")!.valueA).toBeCloseTo(7.5);
    expect(extras.get("link_clicks")).toMatchObject({ valueB: 0, formattedB: "0", percent: null });
    expect(extras.get("cost_per_lpv")).toMatchObject({ valueB: null, formattedB: "N/A", percent: null });
  });
  it("rejects invented metric keys and does not change the existing totals", () => {
    const plain = buildComparisonReportData(base);
    const extra = buildComparisonReportData({ ...base, comparisonMetricKeys: ["cpc_all", "made_up", "spend", "cpc_all"] });
    expect(extra.campaigns[0].additionalMetrics).toHaveLength(1);
    expect(extra.totals).toEqual(plain.totals);
  });
  it("does not turn an absent campaign period into zero observations", () => {
    const report = buildComparisonReportData({ ...base, periodB: { startIso: "2026-08-01", endIso: "2026-08-02" }, comparisonMetricKeys: ["impressions"] });
    expect(report.campaigns[0].additionalMetrics![0]).toMatchObject({ valueB: null, formattedB: "N/A", percent: null });
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("additional comparison output in %s", template => {
  it.each([1, 3, 20, 64])("renders %i extras without empty metric rows and keeps the guide last", async count => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const JSZip = (await import("jszip")).default;
    const { renderComparisonPptx } = await import("../../pptx/render");
    const report = buildComparisonReportData(base);
    report.campaigns[0].additionalMetrics = Array.from({ length: count }, (_, index) => ({ key: `extra_${index}`, label: `EXTRA METRIC ${index + 1}`, valueA: index, valueB: index + 1, formattedA: String(index), formattedB: String(index + 1), percent: index === 0 ? null : -10 }));
    const buffer = await renderComparisonPptx({ templateBuffer: readFileSync(resolve(process.cwd(), "templates", template)), data: report, isLightTemplate: template.includes("light") });
    const zip = await JSZip.loadAsync(buffer);
    const paths = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
    const output = await Promise.all(paths.map(path => zip.file(path)!.async("string")));
    const extras = output.filter(xml => xml.includes(">ADDITIONAL COMPARISON METRICS<"));
    expect(extras).toHaveLength(Math.ceil(count / 8));
    for (let index = 0; index < count; index++) expect(extras.join("\n").split(`>EXTRA METRIC ${index + 1}<`)).toHaveLength(2);
    expect(extras.join("\n")).not.toContain(">AD SPEND<");
    expect(extras.join("\n")).not.toContain(">—<");
    expect(output.at(-1)).toContain("METRIC ABBREVIATION GUIDE");
    expect(output.join("\n")).not.toContain("{{");
    for (const xml of extras) for (const shape of xml.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
      expect((Number(shape[1]) + Number(shape[3])) / 12700).toBeLessThanOrEqual(961);
      expect((Number(shape[2]) + Number(shape[4])) / 12700).toBeLessThanOrEqual(541);
    }
  }, 30_000);
});
