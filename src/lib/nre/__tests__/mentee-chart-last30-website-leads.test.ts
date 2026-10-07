import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/mentee-ascend-last30-sep7-oct6.csv");
const NOW = new Date("2026-10-07T12:00:00Z");
const TZ = "America/Chicago";
const CAMPAIGN = "Ascend Mastermind | Website Leads | Baton Rouge";

describe("Mentee Ascend last-30 website leads chart", () => {
  it("matches Ads Manager Results sum (23), not Website leads column sum (24)", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };

    const data = buildReportData({
      accountName: "Mentee",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
    });

    expect(data.chart).not.toBeNull();
    expect(data.chart!.periodSubLabel).toContain("Sep 7");
    expect(data.chart!.periodSubLabel).toContain("Oct 6");

    const camp = data.chart!.campaigns.find((c) => c.name === CAMPAIGN);
    expect(camp?.resLabel).toBe("WEBSITE LEADS");
    expect(camp?.results).toBe(23);

    const snap = data.chart!.snapshot.objectives.find((o) => o.label === "WEBSITE LEADS");
    expect(parseCellNum(snap?.resultsValue ?? "0")).toBe(23);
  });
});
