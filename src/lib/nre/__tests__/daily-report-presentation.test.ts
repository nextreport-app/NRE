import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { parseCsvText } from "../parse-csv";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { dailyMainTablePages } from "../daily-report-presentation";
import { dailyObjectiveMetricKey } from "../daily-metric-selection";
import { reconcileDayBreakdownReportWithCsv } from "../csv-report-reconciliation";
import { buildDayBreakdownShareReportData } from "../share-report";
import { renderDayBreakdownPptx } from "../../pptx/render";
const source =
  parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),CTR (all),CPC (all),Link clicks
Leads,2026-10-01,100,5,website submission,100,1000,100,10,1,50
Leads,2026-10-02,50,0,website submission,80,100,5,5,10,0`);
const base = {
  accountName: "Example",
  currencySymbol: "$",
  timezone: "UTC",
  mtdDailyRows: source.rows,
  csvHeaders: source.headers,
  dateRange: { startIso: "2026-10-01", endIso: "2026-10-02" },
};
const metrics = (data: ReturnType<typeof buildDayBreakdownReportData>) =>
  Object.fromEntries(
    data
      .presentation!.summaryPages.flat()
      .map((metric) => [metric.label, metric.value]),
  );
describe("Daily period totals and uniform tables", () => {
  it("includes spend on zero-result days and recomputes weighted rates", () => {
    const data = buildDayBreakdownReportData(base),
      totals = metrics(data);
    expect(totals["AD SPEND"]).toBe("$150");
    expect(totals["WEBSITE LEADS"]).toBe("5");
    expect(totals["COST PER WEBSITE LEAD"]).toBe("$30.00");
    expect(totals["CTR (ALL)"]).toBe("9.55%");
    expect(totals["CPC (ALL)"]).toBe("$1.43");
    expect(totals["REACH (EST.)"]).toBe("129");
    expect(buildDayBreakdownShareReportData(data).dailyPresentation).toEqual(
      data.presentation,
    );
    expect(
      reconcileDayBreakdownReportWithCsv({
        report: data,
        mtdDailyRows: source.rows,
        currencySymbol: "$",
        selectedCampaigns: null,
      }).status,
    ).toBe("ok");
    data
      .presentation!.summaryPages.flat()
      .find((metric) => metric.label === "COST PER WEBSITE LEAD")!.value =
      "$999.00";
    expect(
      reconcileDayBreakdownReportWithCsv({
        report: data,
        mtdDailyRows: source.rows,
        currencySymbol: "$",
        selectedCampaigns: null,
      }).status,
    ).toBe("mismatch");
  });
  it("omits removed metrics from period totals and does not create trends", () => {
    const rows = source.rows.map((row, index) =>
      index
        ? {
            ...row,
            date_start: "2026-10-03",
            date_end: "2026-10-03",
            _raw: { ...row._raw, Day: "2026-10-03" },
          }
        : row,
    );
    const data = buildDayBreakdownReportData({
      ...base,
      mtdDailyRows: rows,
      dateRange: { startIso: "2026-10-01", endIso: "2026-10-03" },
      dailyExcludedMetricKeys: ["spend", "reach"],
    });
    expect(metrics(data)["AD SPEND"]).toBeUndefined();
    expect(Object.keys(metrics(data))).not.toContain("REACH");
    expect("trendPages" in data.presentation!).toBe(false);
  });
  it("avoids duplicate totals and one-point charts for single-day reports", () => {
    expect(
      buildDayBreakdownReportData({
        ...base,
        dateRange: { startIso: "2026-10-01", endIso: "2026-10-01" },
      }).presentation,
    ).toBeUndefined();
  });
  it("paginates days, mixed-objective columns and cards without dropping metrics", () => {
    const parsed = parseCsvText(
      `Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all)\n${Array.from({ length: 35 }, (_, day) => ["website submission", "Purchases", "Link clicks"].map((goal, index) => `Campaign${index},${new Date(Date.UTC(2026, 8, 1 + day)).toISOString().slice(0, 10)},10,2,${goal},100,1000,40`).join("\n")).join("\n")}`,
    );
    const data = buildDayBreakdownReportData({
      ...base,
      mtdDailyRows: parsed.rows,
      csvHeaders: parsed.headers,
      dateRange: { startIso: "2026-09-01", endIso: "2026-10-05" },
    });
    const pages = dailyMainTablePages(data);
    expect(pages).toHaveLength(10);
    expect(
      pages.every(
        (page) =>
          page.rows.length <= 8 &&
          page.columns.length <= 8 &&
          page.columns[0] === 0,
      ),
    ).toBe(true);
    expect(pages.slice(0, 2).flatMap((page) => page.columns.slice(1))).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    expect(data.presentation!.summaryPages.flat()).toHaveLength(11);
    expect(
      data.presentation!.summaryPages.every((page) => page.length <= 8),
    ).toBe(true);
    expect(metrics(data)["COST PER PURCHASE"]).toBe("$5.00");
    expect(metrics(data)["WEBSITE LEADS"]).toBe("70");
    const hidden = buildDayBreakdownReportData({
      ...base,
      dailyExcludedMetricKeys: [
        dailyObjectiveMetricKey("objective_results", "WEBSITE LEADS"),
      ],
    });
    expect(metrics(hidden)["WEBSITE LEADS"]).toBeUndefined();
  });
  it.each(["dark.pptx", "meta-ads-light.pptx"])(
    "uses Weekly native cards and removes chart slides in %s",
    async (template) => {
      const data = buildDayBreakdownReportData(base);
      const zip = await JSZip.loadAsync(
        await renderDayBreakdownPptx({
          templateBuffer: readFileSync(`templates/${template}`),
          data,
          isLightTemplate: template.includes("light"),
        }),
      );
      const paths = Object.keys(zip.files)
        .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
        .sort(
          (a, b) =>
            Number(a.match(/slide(\d+)/)![1]) -
            Number(b.match(/slide(\d+)/)![1]),
        );
      const slides = await Promise.all(
        paths.map((path) => zip.file(path)!.async("string")),
      );
      expect(slides).toHaveLength(4);
      expect(slides[1]).toContain("SELECTED PERIOD TOTALS");
      expect(slides[1]).toContain("CAMPAIGN SUMMARY");
      expect(slides[1]).toContain("KEY INSIGHTS");
      expect(slides[1]).toContain("WEBSITE LEADS");
      expect(slides[3]).toContain("METRIC ABBREVIATION GUIDE");
      expect(slides.join("\n")).not.toMatch(/DAILY PERFORMANCE TREND|ADDITIONAL DAILY METRICS|\{\{/);
    },
    30_000,
  );
});
