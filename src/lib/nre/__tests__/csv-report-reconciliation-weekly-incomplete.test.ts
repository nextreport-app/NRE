import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { getRowDate } from "../columns";
import { fmtCurrency, parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/gz-australia-weekly-verify.csv");
const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";
const TZ = "Australia/Sydney";

describe("CSV verification — date gaps require review independently of matching totals", () => {
  const allRows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const weeklyRange = { startIso: "2026-10-02", endIso: "2026-10-08" };
  const now = new Date("2026-10-08T14:00:00Z");

  it("keeps matching totals while warning when Oct 2 is absent from a Last-30 export", () => {
    const rows = allRows.filter((r) => getRowDate(r) !== "2026-10-02");
    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now,
    });

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now,
    });

    expect(verification.status).toBe("ok");
    expect(verification.coverageWarnings).toEqual([
      expect.objectContaining({ missingDays: ["2026-10-02"] }),
    ]);
    expect(verification.checks.every(check => check.status === "ok")).toBe(true);
    const weeklySpend = verification.checks.find(
      (c) => c.scope.startsWith("Report week") && c.metric === "Amount spent",
    );
    expect(weeklySpend?.status).toBe("ok");
  });

  it("flags mismatch when report spend is wrong but CSV sum is unchanged", () => {
    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: allRows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange: { startIso: "2026-09-28", endIso: "2026-10-04" },
      reportType: "WEEKLY",
      now: new Date("2026-10-05T12:00:00Z"),
    });

    const slide = report.campaignSlides[0];
    expect(slide).toBeTruthy();
    slide!.metrics.spend = fmtCurrency(parseCellNum(slide!.metrics.spend) - 5, "A$");

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: allRows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange: { startIso: "2026-09-28", endIso: "2026-10-04" },
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now: new Date("2026-10-05T12:00:00Z"),
    });

    expect(verification.status).toBe("mismatch");
    const weeklySpend = verification.checks.find(
      (c) => c.scope.startsWith("Report week") && c.metric === "Amount spent",
    );
    expect(weeklySpend?.status).toBe("mismatch");
  });
});
