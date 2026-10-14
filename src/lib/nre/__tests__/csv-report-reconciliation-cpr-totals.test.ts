import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/gz-australia-weekly-verify.csv");
const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";

describe("CSV reconciliation — CPR uses spend ÷ results (Ads Manager parity)", () => {
  it("flags when weekly results are wrong even if per-slide CPR averages look fine", () => {
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
    const spend = parseCellNum(slide!.metrics.spend);
    slide!.metrics.results = String(parseCellNum(slide!.metrics.results) + 3);

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

    expect(verification.status).toBe("mismatch");
    const weeklyResults = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric !== "Amount spent" && c.metric !== "Daily rows in report week",
    );
    expect(weeklyResults?.status).toBe("mismatch");
  });
});
