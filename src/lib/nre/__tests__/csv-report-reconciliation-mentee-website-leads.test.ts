import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

const FIXTURE = resolve(__dirname, "fixtures/mentee-ascend-last30-sep7-oct6.csv");
const NOW = new Date("2026-10-07T12:00:00Z");
const TZ = "America/Chicago";
const CAMPAIGN = "Ascend Mastermind | Website Leads | Baton Rouge";
const OBJECTIVE = { resultLabel: "WEBSITE LEADS" as const, costLabel: "COST PER LEAD" as const };

describe("CSV verification — Mentee website leads", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const weeklyRange = { startIso: "2026-09-29", endIso: "2026-10-05" };

  it("uses day-level CSV reference (23) for Last 30 days chart scope", () => {
    const report = buildReportData({
      accountName: "Mentee",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectiveOverrides: { [CAMPAIGN]: OBJECTIVE },
    });

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "$",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
    });

    const chartCheck = verification.checks.find(
      (c) => c.scope === "Last 30 days (chart)" && c.metric === "WEBSITE LEADS",
    );
    expect(chartCheck?.csvDisplay).toBe("23");
    expect(chartCheck?.status).toBe("ok");
  });

  it("flags a 24 vs 23 report/chart mismatch against the CSV reference", () => {
    const report = buildReportData({
      accountName: "Mentee",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectiveOverrides: { [CAMPAIGN]: OBJECTIVE },
    });

    expect(report.chart).not.toBeNull();
    report.chart!.campaigns[0]!.results = 24;
    const wlObjective = report.chart!.snapshot.objectives.find((o) => o.label === "WEBSITE LEADS");
    if (wlObjective) wlObjective.resultsValue = "24";

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "$",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
    });

    expect(verification.status).toBe("mismatch");
    const chartCheck = verification.checks.find(
      (c) => c.scope === "Last 30 days (chart)" && c.metric === "WEBSITE LEADS",
    );
    expect(chartCheck?.status).toBe("mismatch");
    expect(chartCheck?.reportDisplay).toBe("24");
    expect(chartCheck?.csvDisplay).toBe("23");
  });
});
