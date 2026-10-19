import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { computeWeeklyRangeOptions } from "../date-range";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/dc-weekly-credit-firm-oct11-17-2026.csv");
const CAMPAIGN = "DC Leads Campaign Main";

/**
 * CSV exported Oct 18 (data through Oct 17); report generated Oct 19.
 * Calendar last7 is Oct 12–18 but data caps to Oct 11–17 — deck and verify must match.
 */
describe("stale CSV weekly window — capRangeToData applied before aggregation", () => {
  it("deck weekly totals match CSV verification for Oct 11–17", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const now = new Date("2026-10-19T16:00:00Z");
    const timezone = "America/New_York";
    const weeklyRange = computeWeeklyRangeOptions(rows, now, timezone).last7;
    expect(weeklyRange).toEqual({ startIso: "2026-10-12", endIso: "2026-10-18" });

    const report = buildReportData({
      accountName: "Credit Firm Inc",
      currencySymbol: "$",
      timezone,
      monthlyBudget: 500,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now,
    });

    const slide = report.campaignSlides[0];
    expect(slide).toBeTruthy();
    expect(slide!.dateRangeLine).toContain("October 11");
    expect(slide!.dateRangeLine).toContain("October 17");
    expect(parseCellNum(slide!.metrics.spend)).toBeCloseTo(105, 0);
    expect(parseCellNum(slide!.metrics.results)).toBe(3);

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone,
      currencySymbol: "$",
      now,
    });

    expect(verification.status).toBe("ok");
    const weeklySpend = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric === "Amount spent",
    );
    expect(weeklySpend?.status).toBe("ok");
  });
});
