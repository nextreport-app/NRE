import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { comparisonSummaryPages } from "../../nre/comparison-summary-pagination";
import { parseCsvText } from "../../nre/parse-csv";
import { buildComparisonReportData } from "../../nre/report-data";
import { renderComparisonPptx } from "../render";

const parsed = parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions
Example A,2026-10-01,100,10,Website leads,100,1000
Example B,2026-10-01,100,1,Website leads,100,1000
Example A,2026-09-01,50,10,Website leads,100,1000
Example B,2026-09-01,50,1,Website leads,100,1000`);
const data = () => buildComparisonReportData({ accountName: "Example", currencySymbol: "$", timezone: "UTC", mtdDailyRows: parsed.rows, csvHeaders: parsed.headers, periodA: { startIso: "2026-10-01", endIso: "2026-10-01" }, periodB: { startIso: "2026-09-01", endIso: "2026-09-01" } });
async function slideXml(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return Promise.all(Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a,b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1])).map(path => zip.file(path)!.async("string")));
}

describe("readable comparison summary pagination", () => {
  it.each([0, 1, 2, 3, 8, 20])("preserves all %i campaign rows and places account totals only on the final page", count => {
    const campaigns = Array.from({ length: count }, (_, index) => index);
    const pages = comparisonSummaryPages(campaigns);
    expect(pages.flatMap(page => page.campaigns)).toEqual(campaigns);
    expect(pages.filter(page => page.includeTotal)).toHaveLength(1);
    expect(pages.at(-1)!.includeTotal).toBe(true);
    for (const page of pages) expect(page.campaigns.length + Number(page.includeTotal)).toBeLessThanOrEqual(3);
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("readable summary in %s", template => {
  const render = (report: ReturnType<typeof data>) => renderComparisonPptx({ templateBuffer: readFileSync(resolve(process.cwd(), "templates", template)), data: report, isLightTemplate: template.includes("light") });
  it("includes weighted account cost per result and larger fonts in all three sections", async () => {
    const xml = (await slideXml(await render(data()))).find(slide => slide.includes("CAMPAIGN COMPARISON SUMMARY"))!;
    expect(xml).toContain("AD SPEND");
    expect(xml).toContain("WEBSITE LEADS");
    expect(xml).toContain("COST PER WEBSITE LEAD");
    expect(xml).toContain("$18.18"); // $200 / 11; not the average of $10 and $100.
    expect(xml).toContain("$9.09");
    expect(xml).not.toContain("$55.00");
    expect(xml).toContain('sz="1700"');
    expect(xml).toContain('sz="1400"');
    const change = [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].map(match => match[0]).filter(shape => shape.includes(">+100%<"));
    expect(change.some(shape => shape.includes(`srgbClr val="${template.includes("light") ? "b91c1c" : "fc8181"}"`))).toBe(true);
  });
  it("paginates many campaigns without clipping and leaves the abbreviation guide last", async () => {
    const report = data();
    report.campaigns = Array.from({ length: 8 }, (_, index) => ({ ...report.campaigns[0], campaignName: `Campaign ${index + 1}` }));
    const output = await slideXml(await render(report));
    const summaries = output.filter(xml => xml.includes("CAMPAIGN COMPARISON SUMMARY"));
    expect(summaries).toHaveLength(3);
    for (let index = 1; index <= 8; index++) expect(summaries.filter(xml => xml.includes(`>Campaign ${index}<`))).toHaveLength(1);
    expect(summaries.filter(xml => xml.includes("TOTAL — ALL CAMPAIGNS"))).toHaveLength(1);
    expect(output.at(-1)).toContain("METRIC ABBREVIATION GUIDE");
    for (const xml of summaries) for (const shape of xml.matchAll(/<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)) {
      expect((Number(shape[1]) + Number(shape[3])) / 12700).toBeLessThanOrEqual(961);
      expect((Number(shape[2]) + Number(shape[4])) / 12700).toBeLessThanOrEqual(541);
    }
  });
  it("uses the campaign's own cost unit for a single reach campaign", async () => {
    const report = data();
    report.campaigns = [{ ...report.campaigns[0], objective: "REACH", costLabel: "COST PER 1K REACHED", metricsA: { ...report.campaigns[0].metricsA, cpr: { value: 17, formatted: "$17.00" } } }];
    const xml = (await slideXml(await render(report))).find(slide => slide.includes("CAMPAIGN COMPARISON SUMMARY"))!;
    expect(xml.split(">$17.00<")).toHaveLength(3); // Campaign and account total retain the same unit.
  });
  it("does not add overlapping campaign reach into a comparable account result", async () => {
    const report = data();
    report.campaigns = report.campaigns.map(campaign => ({ ...campaign, objective: "REACH", costLabel: "COST PER 1K REACHED" }));
    const xml = (await slideXml(await render(report))).find(slide => slide.includes("CAMPAIGN COMPARISON SUMMARY"))!;
    expect(xml).toContain("Campaign reach can overlap");
    expect(xml).toContain(">N/A<");
  });
  it("does not display a blended account cost across different campaign objectives", async () => {
    const report = data();
    report.campaigns[1].objective = "PURCHASES";
    report.campaigns[1].costLabel = "COST PER PURCHASE";
    const xml = (await slideXml(await render(report))).find(slide => slide.includes("CAMPAIGN COMPARISON SUMMARY"))!;
    expect(xml).toContain("Different campaign objectives");
    expect(xml).toContain(">N/A<");
    expect(xml).not.toContain("$18.18");
  });
});
