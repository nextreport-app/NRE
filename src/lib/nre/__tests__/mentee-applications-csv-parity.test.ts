import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import {
  buildCampaignObjectiveMap,
  getGroupedResultDisplayForObjective,
  normalizeCampaignName,
} from "../objective";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { getRowDate } from "../columns";
import { parseCellNum } from "../format";
import { filterRowsByCampaigns } from "../campaigns";

const FIXTURE = resolve(__dirname, "fixtures/mentee-weekly-oct2026.csv");
const NOW = new Date("2026-10-14T12:00:00Z");
const TZ = "America/Chicago";
const CAMPAIGN = "Ascend Mastermind | Website Leads | Baton Rouge";
const APPLICATIONS = {
  resultLabel: "WEBSITE SUBMIT APPLICATIONS" as const,
  costLabel: "COST PER APPLICATION" as const,
};

describe("Mentee weekly — applications objective CSV parity", () => {
  const rows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const weeklyRange = { startIso: "2026-10-07", endIso: "2026-10-13" };

  it("names Website Leads campaigns as WEBSITE LEADS by default", () => {
    const map = buildCampaignObjectiveMap(rows);
    expect(map.get(normalizeCampaignName(CAMPAIGN))?.resultLabel).toBe("WEBSITE LEADS");
  });

  it("passes CSV verification with default WEBSITE LEADS detection", () => {
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
    });

    expect(verification.status).toBe("ok");
  });

  it("matches CSV verification when user confirms APPLICATIONS objective", () => {
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
      campaignObjectives: { [CAMPAIGN]: APPLICATIONS },
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
      campaignObjectives: { [CAMPAIGN]: APPLICATIONS },
    });

    expect(verification.status).toBe("ok");
    expect(report.campaignSlides[0]?.metrics.results).not.toBe("0");
  });
});

describe("Mentee Ascend — Oct 14–20 CPR (applications, off-days labeled Website Leads)", () => {
  const FIXTURE_FULL = resolve(__dirname, "fixtures/mentee-ascend-week-oct14-20.csv");
  const rows = parseCsvText(readFileSync(FIXTURE_FULL, "utf8")).rows;
  const weeklyRange = { startIso: "2026-10-14", endIso: "2026-10-20" };
  const campRows = filterRowsByCampaigns(rows, [CAMPAIGN]);
  const weekRows = campRows.filter((r) => {
    const d = getRowDate(r);
    return d >= weeklyRange.startIso && d <= weeklyRange.endIso;
  });

  it("uses total week spend ÷ Results (~$18.33), not costed-day spend (~$10)", () => {
    const spend = weekRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const apps = weekRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    expect(apps).toBe(4);
    expect(spend).toBeCloseTo(73.33, 1);

    const display = getGroupedResultDisplayForObjective(weekRows, APPLICATIONS, "$");
    expect(display.resultValue).toBe("4");
    expect(parseCellNum(display.cprValue.replace(/[^0-9.]/g, ""))).toBeCloseTo(spend / apps, 2);
  });

  it("MTD and chart CPR match blended spend ÷ applications", () => {
    const report = buildReportData({
      accountName: "Mentee",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: new Date("2026-10-21T12:00:00Z"),
      campaignObjectives: { [CAMPAIGN]: APPLICATIONS },
    });

    const octRows = campRows.filter((r) => getRowDate(r).startsWith("2026-10"));
    const octSpend = octRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const octApps = octRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    const mtdCol = report.mtdRow.resultColumns.find((c) => c.label === "WEBSITE SUBMIT APPLICATIONS");
    expect(mtdCol?.value).toBe(String(octApps));
    expect(parseCellNum(mtdCol?.cprValue?.replace(/[^0-9.]/g, "") ?? 0)).toBeCloseTo(octSpend / octApps, 2);

    const bar = report.chart?.campaigns[0];
    expect(bar?.results).toBe(rows.reduce((s, r) => s + parseCellNum(r.results), 0));
    expect(bar?.cpr).toBeCloseTo(
      rows.reduce((s, r) => s + parseCellNum(r.spend), 0) / bar!.results,
      2,
    );
  });
});
