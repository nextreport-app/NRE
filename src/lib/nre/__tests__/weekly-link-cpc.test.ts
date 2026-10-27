import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { listAvailableMetrics } from "../available-metrics";

// Synthetic daily export: link-CPC exists, but Link clicks does not.
const csv = `Campaign name,Ad set name,Day,Amount spent (USD),Impressions,Reach,CTR (all),CPC (cost per link click),Landing page views,Website leads,Result type,Results
Example,Example set,2026-10-20,12,1000,800,4,0.60,15,1,Website leads,1
Example,Example set,2026-10-21,18,1000,800,4,0.90,15,1,Website leads,1
Example,Another set,2026-10-21,12,1000,800,4,0.60,15,1,Website leads,1`;

describe("weekly link CPC without a link-count column", () => {
  it("renders the selected metric on campaign and ad-set slides using only the selected window", () => {
    const { rows, headers } = parseCsvText(csv + "\nExample,Example set,2026-10-19,999,1000,800,4,99,15,1,Website leads,1");
    const keys = ["spend", "reach", "impressions", "website_leads", "cost_per_website_lead", "ctr", "landing_page_views", "cpc_link_click"];
    const report = buildReportData({ accountName: "Example", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, weeklyRange: { startIso: "2026-10-20", endIso: "2026-10-21" }, now: new Date("2026-10-22T12:00:00Z"), reportType: "WEEKLY", selectedMetrics: listAvailableMetrics(headers, "META"), campaignMetricOverrides: { example: keys } });
    const card = report.campaignSlides[0].dynamicMetrics.find(m => m?.key === "cpc_link_click");
    expect(card).toMatchObject({ label: "COST PER LINK CLICK", value: "$0.70" });
    expect(report.adSetSlides.find(s => s.adSetName === "Example set")!.dynamicMetrics.find(m => m?.key === "cpc_link_click")?.value).toBe("$0.75");
    // All-click CPC remains separate: 42 spend / 120 all clicks = .35.
    expect(report.campaignSlides[0].metrics.cpc).toBe("$0.35");
  });
});
