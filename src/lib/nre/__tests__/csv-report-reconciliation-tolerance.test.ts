import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { fmtCurrency, parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/gz-australia-weekly-verify.csv");
const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";

describe("CSV reconciliation spend tolerance", () => {
  it("does not flag weekly spend when report total is $1 below CSV sum", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const weeklyRange = { startIso: "2026-09-28", endIso: "2026-10-04" };
    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: "Australia/Sydney",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: new Date("2026-10-05T12:00:00Z"),
    });

    const slide = report.campaignSlides[0];
    expect(slide).toBeTruthy();
    const spendNum = parseCellNum(slide!.metrics.spend);
    slide!.metrics.spend = fmtCurrency(Math.max(0, spendNum - 1), "A$");

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: "Australia/Sydney",
      currencySymbol: "A$",
      now: new Date("2026-10-05T12:00:00Z"),
    });

    const weeklySpend = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric === "Amount spent",
    );
    expect(weeklySpend?.status).toBe("ok");
    expect(verification.status).toBe("ok");
  });
});
