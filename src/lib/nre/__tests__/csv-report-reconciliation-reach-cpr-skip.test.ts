import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

const FIXTURE = resolve(__dirname, "fixtures/dc-weekly-southaven-reach.csv");

describe("CSV reconciliation reach campaigns", () => {
  it("does not flag cost per 1K reach (derived rate — not comparable to CSV Cost per result column)", () => {
    const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };
    const report = buildReportData({
      accountName: "Southaven",
      currencySymbol: "$",
      timezone: "America/Chicago",
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: null,
      weeklyRange,
      reportType: "WEEKLY",
      now: new Date("2026-10-06T12:00:00Z"),
    });

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: null,
      weeklyRange,
      reportType: "WEEKLY",
      timezone: "America/Chicago",
      currencySymbol: "$",
      now: new Date("2026-10-06T12:00:00Z"),
      platform: "META",
    });

    const cprChecks = verification.checks.filter((c) => c.metric.toUpperCase().includes("1K REACH"));
    expect(cprChecks).toHaveLength(0);
  });
});
