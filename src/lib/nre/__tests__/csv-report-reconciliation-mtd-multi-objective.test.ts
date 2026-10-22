import { describe, expect, it } from "vitest";
import type { NreRow } from "../columns";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

const NOW = new Date("2026-10-20T12:00:00Z");

function dayRow(overrides: Partial<NreRow> = {}): NreRow {
  return {
    _raw: {},
    campaign_name: "Campaign",
    ad_set_name: "Set 1",
    result_type: "",
    spend: "0",
    reach: "0",
    impressions: "1000",
    results: "0",
    ctr: "1",
    cpc: "1",
    date_start: "2026-10-01",
    date_end: "2026-10-01",
    ...overrides,
  };
}

const mixedMtdRows: NreRow[] = [
  dayRow({
    campaign_name: "Awareness",
    result_type: "Reach",
    reach: "20000",
    results: "0",
    spend: "400",
  }),
  dayRow({
    campaign_name: "Meta Leads",
    leads: "14",
    results: "14",
    spend: "596",
  }),
  dayRow({
    campaign_name: "Website Leads",
    website_leads: "9",
    results: "9",
    spend: "155",
  }),
];

describe("CSV verification — multi-objective MTD Combined Total", () => {
  it("verifies CPR for every objective column using bucket spend, not account total spend", () => {
    const report = buildReportData({
      accountName: "Mixed",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      mtdDailyRows: mixedMtdRows,
      now: NOW,
      reportType: "WEEKLY",
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    expect(report.mtdRow.resultColumns.map((c) => c.label).sort()).toEqual([
      "META FORM LEADS",
      "REACH",
      "WEBSITE LEADS",
    ]);

    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: mixedMtdRows,
      reportType: "WEEKLY",
      timezone: "America/New_York",
      currencySymbol: "$",
      now: NOW,
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });

    const mtdScope = verification.checks.filter((c) => c.scope.startsWith("Month-to-date"));
    const websiteCpr = mtdScope.find(
      (c) => c.metric === "COST PER WEBSITE LEAD" && c.scope.startsWith("Month-to-date"),
    );
    expect(websiteCpr).toBeTruthy();
    expect(websiteCpr!.status).toBe("ok");

    const websiteCol = report.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")!;
    websiteCol.cprValue = "$5.00";

    const bad = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: mixedMtdRows,
      reportType: "WEEKLY",
      timezone: "America/New_York",
      currencySymbol: "$",
      now: NOW,
      weeklyRange: { startIso: "2026-10-13", endIso: "2026-10-19" },
    });
    const badWebsiteCpr = bad.checks.find(
      (c) => c.metric === "COST PER WEBSITE LEAD" && c.scope.startsWith("Month-to-date"),
    );
    expect(badWebsiteCpr?.status).toBe("mismatch");
    expect(badWebsiteCpr?.note).toMatch(/must match spend ÷ results/i);
  });
});
