import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { validateMtdDailyCsv } from "../validate";
import {
  assertCampaignSlideCprParity,
  assertChartCampaignCprParity,
  parseCprFromDisplay,
} from "../cpr-parity";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { getRowDate } from "../columns";
import { parseCellNum } from "../format";
import { filterRowsByCampaigns } from "../campaigns";

const CAMPAIGN = "DC Leads Campaign Main";
const OBJECTIVE = {
  resultLabel: "WEBSITE LEADS" as const,
  costLabel: "COST PER WEBSITE LEAD" as const,
};
const weeklyRange = { startIso: "2026-10-14", endIso: "2026-10-20" };
const NOW = new Date("2026-10-21T12:00:00Z");
const TZ = "America/New_York";

function loadValidated(path: string) {
  const parsed = parseCsvText(readFileSync(path, "utf8"));
  validateMtdDailyCsv(parsed.colMap, parsed.rows, NOW, parsed.headers, "META");
  return parsed.rows;
}

describe("Credit Firm — Ads Reporting vs Campaigns-screen CSV parity (Oct 14–20)", () => {
  const reportingRows = loadValidated(
    resolve(__dirname, "fixtures/dc-credit-firm-reporting-week-oct14-20.csv"),
  );
  const campaignsRows = loadValidated(resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv"));

  function reportFor(rows: typeof reportingRows) {
    return buildReportData({
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
  }

  it("same week spend, results, and CPR on campaign slide", () => {
    const reporting = reportFor(reportingRows);
    const campaigns = reportFor(campaignsRows);
    const rSlide = reporting.campaignSlides.find((s) => s.campaignName === CAMPAIGN)!;
    const cSlide = campaigns.campaignSlides.find((s) => s.campaignName === CAMPAIGN)!;

    expect(rSlide.metrics.results).toBe(cSlide.metrics.results);
    expect(parseCprFromDisplay(rSlide.metrics.cpr)).toBeCloseTo(parseCprFromDisplay(cSlide.metrics.cpr), 2);
    assertCampaignSlideCprParity(rSlide);
    assertCampaignSlideCprParity(cSlide);

    const weekRows = filterRowsByCampaigns(reportingRows, [CAMPAIGN]).filter((r) => {
      const d = getRowDate(r);
      return d >= weeklyRange.startIso && d <= weeklyRange.endIso;
    });
    const spend = weekRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const leads = weekRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    expect(leads).toBe(6);
    expect(parseCprFromDisplay(cSlide.metrics.cpr)).toBeCloseTo(spend / leads, 2);
  });

  it("CSV verification ok for both export shapes", () => {
    for (const rows of [reportingRows, campaignsRows]) {
      const report = reportFor(rows);
      assertChartCampaignCprParity(report, CAMPAIGN);
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
      expect(verification.status).toBe("ok");
    }
  });
});
