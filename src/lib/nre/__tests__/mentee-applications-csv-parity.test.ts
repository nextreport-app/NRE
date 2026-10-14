import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { buildCampaignObjectiveMap, normalizeCampaignName } from "../objective";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

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
