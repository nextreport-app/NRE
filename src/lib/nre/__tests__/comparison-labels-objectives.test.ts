import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareComparisonReportView } from "@/components/share-comparison-report-view";
import { SiteThemeProvider } from "@/components/site-theme-provider";
import { buildShareComparisonReportData } from "../share-comparison-report";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { parseCsvText } from "../parse-csv";
import { buildComparisonReportData } from "../report-data";
import { comparisonPresetPeriods } from "../comparison-period-selection";
import { comparisonPeriodDescription } from "../comparison-period-description";
import { reconcileComparisonReportWithCsv } from "../csv-report-reconciliation";
import { renderComparisonPptx } from "../../pptx/render";

const now = new Date("2026-11-01T12:00:00Z");
const goals = { "Form campaign": { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" }, "Link campaign": { resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK" }, "Purchase campaign": { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" } };
function fixture(preset: "thisWeek" | "last15" | "last30") {
  const periods = comparisonPresetPeriods(preset, now, "UTC");
  const source = parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Link clicks\n" + [
    `Form campaign,${periods.periodA.endIso},100,10,On-Facebook leads,100,1000,5`,
    `Link campaign,${periods.periodA.endIso},100,100,Link clicks,100,1000,100`,
    `Purchase campaign,${periods.periodA.endIso},100,2,Purchases,100,1000,5`,
    `Form campaign,${periods.periodB.endIso},100,5,On-Facebook leads,100,1000,5`,
    `Link campaign,${periods.periodB.endIso},100,200,Link clicks,100,1000,200`,
    `Purchase campaign,${periods.periodB.endIso},100,1,Purchases,100,1000,5`,
  ].join("\n"));
  return { periods, source, report: buildComparisonReportData({ accountName: "Mixed objectives", currencySymbol: "$", timezone: "UTC", mtdDailyRows: source.rows, csvHeaders: source.headers, campaignObjectives: goals, comparisonMetricKeys: ["impressions"], ...periods, now }) };
}

describe("comparison descriptions", () => {
  it.each([["thisWeek", 7], ["last15", 15], ["last30", 30]] as const)("names %s without replacing exact dates", (preset, count) => {
    const { report, source, periods } = fixture(preset);
    expect(report.comparisonLabel).toBe(`Last ${count} days vs previous ${count} days`);
    expect(report.periodATitle).toBe(`LAST ${count} DAYS`);
    const campaigns = new Map(report.campaigns.map(campaign => [campaign.campaignName, campaign]));
    expect(campaigns.get("Form campaign")).toMatchObject({ objective: "META FORM LEADS", costLabel: "COST PER LEAD", metricsA: { results: { value: 10 }, cpr: { value: 10 } }, metricsB: { results: { value: 5 }, cpr: { value: 20 } } });
    expect(campaigns.get("Link campaign")).toMatchObject({ objective: "LINK CLICKS", costLabel: "COST PER CLICK", metricsA: { results: { value: 100 }, cpr: { value: 1 } }, metricsB: { results: { value: 200 }, cpr: { value: 0.5 } } });
    expect(campaigns.get("Purchase campaign")).toMatchObject({ objective: "PURCHASES", costLabel: "COST PER PURCHASE", metricsA: { results: { value: 2 }, cpr: { value: 50 } }, metricsB: { results: { value: 1 }, cpr: { value: 100 } } });
    expect(reconcileComparisonReportWithCsv({ report, mtdDailyRows: source.rows, selectedCampaigns: null, campaignObjectives: goals, ...periods, currencySymbol: "$", platform: "META" }).status).toBe("ok");
  });
  it("automatically recognises On-Facebook leads as Meta form leads without an override", () => {
    const { source, periods } = fixture("thisWeek");
    const report = buildComparisonReportData({ accountName: "Example", currencySymbol: "$", timezone: "UTC", mtdDailyRows: source.rows, csvHeaders: source.headers, ...periods, now });
    expect(report.campaigns.find(campaign => campaign.campaignName === "Form campaign")).toMatchObject({ objective: "META FORM LEADS", metricsA: { results: { value: 10 } } });
  });
  it("shows readable labels and per-campaign objectives in the shared report without blended mixed-objective totals", () => {
    const { report } = fixture("thisWeek");
    const data = buildShareComparisonReportData(report, "META", {});
    const html = renderToStaticMarkup(createElement(SiteThemeProvider, null, createElement(ShareComparisonReportView, { data })));
    expect(html).toContain("Last 7 days vs previous 7 days");
    for (const objective of ["META FORM LEADS", "LINK CLICKS", "PURCHASES"]) expect(html).toContain(objective);
    const account = html.slice(html.indexOf("Account totals"));
    expect(account).toContain("Ad Spend");
    expect(account).toContain("Results and cost per result are shown per campaign");
    expect(account).not.toContain(">Cost per result<");
  });
  it("does not call an old historical window the last seven days", () => {
    const periods = comparisonPresetPeriods("thisWeek", new Date("2025-09-15T12:00:00Z"), "UTC");
    expect(comparisonPeriodDescription(periods.periodA, periods.periodB, now).comparisonLabel).toBe("7 days vs previous 7 days");
  });
  it("labels unequal or non-adjacent ranges as custom", () => {
    const label = comparisonPeriodDescription({ startIso: "2026-10-01", endIso: "2026-10-31" }, { startIso: "2026-08-01", endIso: "2026-08-15" }, now);
    expect(label).toMatchObject({ comparisonLabel: "Custom date comparison", periodATitle: "PERIOD A · 31 DAYS", periodBTitle: "PERIOD B · 15 DAYS" });
  });
  it("honours a confirmed objective instead of silently redetecting a different one", () => {
    const source = parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nExample,2026-10-31,30,10,Website leads,100,1000\nExample,2026-10-24,20,5,Website leads,100,1000");
    const report = buildComparisonReportData({ accountName: "Example", currencySymbol: "$", timezone: "UTC", mtdDailyRows: source.rows, csvHeaders: source.headers, ...comparisonPresetPeriods("thisWeek", now), campaignObjectives: { example: { resultLabel: "REACH", costLabel: "COST PER 1K REACH" } }, now });
    expect(report.campaigns[0]).toMatchObject({ objective: "REACH", costLabel: "COST PER 1K REACH" });
    expect(report.campaigns[0].metricsA.results.value).toBe(100);
    expect(report.campaigns[0].metricsA.cpr.value).toBe(300);
  });
});

describe.each(["dark.pptx", "meta-ads-light.pptx"])("comparison labels in actual %s", template => {
  it.each(["thisWeek", "last15", "last30"] as const)("preserves %s labels on cover, campaign, extra and summary slides", async preset => {
    const { report } = fixture(preset);
    const zip = await JSZip.loadAsync(await renderComparisonPptx({ templateBuffer: readFileSync(resolve(process.cwd(), "templates", template)), data: report, isLightTemplate: template.includes("light") }));
    const paths = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a,b) => Number(a.match(/slide(\d+)/)![1]) - Number(b.match(/slide(\d+)/)![1]));
    const output = await Promise.all(paths.map(path => zip.file(path)!.async("string")));
    expect(output[0]).toContain(report.comparisonLabel!);
    for (const xml of output.slice(1, -1)) {
      expect(xml).toContain(report.periodATitle!);
      expect(xml).toContain(report.periodBTitle!);
    }
    const summaries = output.filter(xml => xml.includes("CAMPAIGN COMPARISON SUMMARY"));
    expect(summaries.some(xml => xml.includes("Form campaign · META FORM LEADS"))).toBe(true);
    expect(summaries.some(xml => xml.includes("Purchase campaign · PURCHASES"))).toBe(true);
    expect(summaries.at(-1)).toContain(">N/A<");
    expect(output.at(-1)).toContain("METRIC ABBREVIATION GUIDE");
    const coverIds = [...output[0].matchAll(/<p:cNvPr id="(\d+)"/g)].map(match => match[1]);
    expect(new Set(coverIds).size).toBe(coverIds.length);
  }, 30_000);
});
