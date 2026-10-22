import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getRowDate } from "../columns";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { getGroupedResultDisplayForObjective } from "../objective";
import { parseCellNum } from "../format";
import { filterRowsByCampaigns } from "../campaigns";

const FIXTURE = resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv");
const CAMPAIGN = "DC Leads Campaign Main";
const OBJECTIVE = {
  resultLabel: "WEBSITE LEADS" as const,
  costLabel: "COST PER WEBSITE LEAD" as const,
};
const TZ = "America/New_York";
const NOW = new Date("2026-10-21T12:00:00Z");
const weeklyRange = { startIso: "2026-10-14", endIso: "2026-10-20" };

describe("DC Leads Campaigns-table CSV — CPL uses total spend ÷ Results (not costed-day spend only)", () => {
  const { rows } = parseCsvText(readFileSync(FIXTURE, "utf8"));
  const campRows = filterRowsByCampaigns(rows, [CAMPAIGN]);

  function blendedCpl(rangeRows: typeof rows): number {
    const spend = rangeRows.reduce((s, r) => s + parseCellNum(r.spend), 0);
    const leads = rangeRows.reduce((s, r) => s + parseCellNum(r.results), 0);
    expect(leads).toBeGreaterThan(0);
    return spend / leads;
  }

  it("weekly campaign slide: ~$16.93 ($102 ÷ 6), not ~$9.75 attributed-only", () => {
    const weekRows = campRows.filter((r) => {
      const d = getRowDate(r);
      return d >= weeklyRange.startIso && d <= weeklyRange.endIso;
    });
    const expected = blendedCpl(weekRows);
    expect(expected).toBeCloseTo(16.93, 1);

    const display = getGroupedResultDisplayForObjective(weekRows, OBJECTIVE, "$");
    expect(display.resultValue).toBe("6");
    expect(parseCellNum(display.cprValue.replace(/[^0-9.]/g, ""))).toBeCloseTo(expected, 2);
  });

  it("MTD Combined Total: ~$21.01 ($294 ÷ 14), not ~$12.17", () => {
    const report = buildReportData({
      accountName: "DC",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: 500,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
    });
    const octRows = campRows.filter((r) => getRowDate(r).startsWith("2026-10"));
    const expected = blendedCpl(octRows);

    const col = report.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(col?.value).toBe("14");
    expect(parseCellNum(col?.cprValue?.replace(/[^0-9.]/g, "") ?? 0)).toBeCloseTo(expected, 2);
    expect(report.mtdRow.spend).toBe("$294");
  });

  it("Last 30 days chart: campaign bar CPL matches total spend ÷ leads for chart window", () => {
    const report = buildReportData({
      accountName: "DC",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: 500,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      now: NOW,
      campaignObjectives: { [CAMPAIGN]: OBJECTIVE },
    });
    expect(report.chart).toBeTruthy();
    const bar = report.chart!.campaigns.find((c) => c.name === CAMPAIGN);
    expect(bar).toBeTruthy();

    const chartEnd = NOW.toISOString().slice(0, 10);
    const chartStart = "2026-09-21";
    const windowRows = campRows.filter((r) => {
      const d = getRowDate(r);
      return d >= chartStart && d <= chartEnd;
    });
    const expected = blendedCpl(windowRows);
    expect(bar!.results).toBe(windowRows.reduce((s, r) => s + parseCellNum(r.results), 0));
    expect(bar!.cpr).toBeCloseTo(expected, 2);
  });
});
