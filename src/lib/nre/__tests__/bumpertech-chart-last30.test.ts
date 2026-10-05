import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { parseCellNum } from "../format";
import { filterRawRowsToRange } from "../creative-report-data";
import { resolveStandardChartRange } from "../date-range";

const FIXTURE = resolve(__dirname, "fixtures/bumpertech-weekly-oct.csv");
const NOW = new Date("2026-10-06T12:00:00Z");
const TZ = "Australia/Sydney";

function csvQuoteSumInRange(rows: ReturnType<typeof parseCsvText>["rows"], startIso: string, endIso: string): number {
  const inRange = filterRawRowsToRange(rows, startIso, endIso);
  return inRange.reduce((sum, r) => {
    const rt = (r.result_type || "").toLowerCase();
    if (!rt.includes("quote")) return sum;
    return sum + parseCellNum(r.results);
  }, 0);
}

function chartQuoteSumForCampaigns(
  rows: ReturnType<typeof parseCsvText>["rows"],
  selected: string[],
  startIso: string,
  endIso: string,
): number {
  const inRange = filterRawRowsToRange(rows, startIso, endIso);
  return inRange.reduce((sum, r) => {
    const name = String(r.campaign_name || "").trim();
    if (!selected.includes(name)) return sum;
    const rt = (r.result_type || "").toLowerCase();
    if (!rt.includes("quote")) return sum;
    return sum + parseCellNum(r.results);
  }, 0);
}

describe("BumperTech last-30 chart", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const allCampaigns = [...new Set(rows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean))];
  const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };
  const chartRange = resolveStandardChartRange({
    reportType: "WEEKLY",
    rows,
    now: NOW,
    timezone: TZ,
    primaryRange: weeklyRange,
    calendarRange: { startIso: "2026-10-01", endIso: "2026-10-05" },
  });

  it("chart quote totals match CSV sum for last 30 days (all selected campaigns)", () => {
    const data = buildReportData({
      accountName: "BumperTech",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: allCampaigns,
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
    });

    expect(data.chart).not.toBeNull();
    const expectedQuotes = csvQuoteSumInRange(rows, chartRange.startIso, chartRange.endIso);

    const chartQuoteCol = data.chart!.snapshot.objectives.find((o) => o.label === "QUOTE REQUESTS");
    const chartQuoteTotal = parseCellNum(chartQuoteCol?.resultsValue ?? "0");
    const campaignQuoteSum = data.chart!.campaigns.reduce(
      (s, c) => s + (c.resLabel === "QUOTE REQUESTS" ? c.results : 0),
      0,
    );

    expect(chartQuoteTotal).toBe(expectedQuotes);
    expect(campaignQuoteSum).toBe(expectedQuotes);
  });

  it("matches 189 quote requests when Re-Targeting is deselected (BumperTech weekly export)", () => {
    const selected = allCampaigns.filter((c) => !c.toLowerCase().includes("re-targeting"));
    const data = buildReportData({
      accountName: "BumperTech",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: selected,
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
    });

    expect(data.chart).not.toBeNull();
    const expectedQuotes = chartQuoteSumForCampaigns(rows, selected, chartRange.startIso, chartRange.endIso);
    expect(expectedQuotes).toBe(189);

    const chartQuoteCol = data.chart!.snapshot.objectives.find((o) => o.label === "QUOTE REQUESTS");
    expect(parseCellNum(chartQuoteCol?.resultsValue ?? "0")).toBe(189);

    const brisbane = data.chart!.campaigns.filter((c) => c.name.toLowerCase().includes("brisbane"));
    expect(brisbane.every((c) => c.resLabel === "QUOTE REQUESTS" && c.results > 0)).toBe(true);
    expect(data.chart!.campaigns.find((c) => c.name.includes("Website Retargeting"))?.results).toBe(108);
  });
});
