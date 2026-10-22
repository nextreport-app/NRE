import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { parseCellNum } from "../format";

const FIXTURE = resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv");
const CAMPAIGN = "DC Leads Campaign Main";
const OBJECTIVE = {
  resultLabel: "WEBSITE LEADS" as const,
  costLabel: "COST PER WEBSITE LEAD" as const,
};
const TZ = "America/New_York";
const NOW = new Date("2026-10-21T12:00:00Z");
const weeklyRange = { startIso: "2026-10-14", endIso: "2026-10-20" };

describe("CSV verification — DC Leads weekly CPR (Campaigns table export)", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;

  it("uses total week spend ÷ Results for report week CPR (~$17, not attributed ~$10)", () => {
    const report = buildReportData({
      accountName: "DC",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: 500,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
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

    const cprCheck = verification.checks.find(
      (c) => c.scope.startsWith("Report week") && c.metric === "COST PER WEBSITE LEAD",
    );
    expect(cprCheck).toBeTruthy();
    expect(cprCheck!.status).toBe("ok");

    const weekRows = rows.filter((r) => {
      const d = r.date_start ?? "";
      return d >= weeklyRange.startIso && d <= weeklyRange.endIso;
    });
    const spend = weekRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const results = weekRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    expect(results).toBe(6);
    expect(spend).toBeCloseTo(101.56, 1);
    const blended = spend / results;
    expect(blended).toBeCloseTo(16.93, 1);
    expect(parseCellNum(cprCheck!.csvDisplay.replace(/[^0-9.]/g, ""))).toBeCloseTo(blended, 0);
  });

  it("fails verification when the printed deck CPR used attributed spend but Ad Spend ÷ Results did not", () => {
    const report = buildReportData({
      accountName: "DC",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: 500,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
    });

    const slide = report.campaignSlides.find((s) => s.campaignName === CAMPAIGN);
    expect(slide).toBeTruthy();
    slide!.metrics.cpr = "$9.75";

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

    const cprCheck = verification.checks.find(
      (c) => c.scope.startsWith("Report week") && c.metric === "COST PER WEBSITE LEAD",
    );
    expect(cprCheck?.status).toBe("mismatch");
    expect(cprCheck?.note).toMatch(/must match spend ÷ results/i);
  });
});
