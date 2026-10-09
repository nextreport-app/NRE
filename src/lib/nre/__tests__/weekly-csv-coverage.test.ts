import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { parseCellNum } from "../format";
import { validateWeeklyCsvDayRowsPresent } from "../weekly-csv-coverage";
import { getRowDate, type NreRow } from "../columns";

const FIXTURE = resolve(__dirname, "fixtures/gz-australia-weekly-verify.csv");
const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";
const TZ = "Australia/Sydney";
const NOW_OCT9 = new Date("2026-10-08T14:00:00Z");

function cloneRowForDay(template: NreRow, dayIso: string, spend: number): NreRow {
  const raw = { ...(template._raw ?? {}) };
  if ("Day" in raw) raw.Day = dayIso;
  for (const key of Object.keys(raw)) {
    if (key.toLowerCase().includes("amount spent")) raw[key] = String(spend);
  }
  return {
    ...template,
    _raw: raw,
    spend: String(spend),
    campaign_name: template.campaign_name,
  };
}

describe("validateWeeklyCsvDayRowsPresent", () => {
  const allRows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
  const weeklyRange = { startIso: "2026-09-28", endIso: "2026-10-04" };

  it("passes when every day in the week has rows for selected campaigns", () => {
    const result = validateWeeklyCsvDayRowsPresent(allRows, weeklyRange, [CAMPAIGN]);
    expect(result.ok).toBe(true);
  });

  it("fails when the first day of the week is missing but later days have spend", () => {
    const rows = allRows.filter((r) => getRowDate(r) !== "2026-09-28");
    const result = validateWeeklyCsvDayRowsPresent(rows, weeklyRange, [CAMPAIGN]);
    expect(result.ok).toBe(false);
    expect(result.missingDays).toContain("2026-09-28");
    expect(result.error).toMatch(/missing daily rows/i);
  });
});

describe("GZ Australia weekly spend — calendar week vs CSV rows", () => {
  const template = parseCsvText(readFileSync(FIXTURE, "utf8")).rows.find(
    (r) => getRowDate(r) === "2026-10-02",
  )!;
  const weeklyRange = { startIso: "2026-10-02", endIso: "2026-10-08" };
  const spendByDay: Record<string, number> = {
    "2026-10-02": 11.81,
    "2026-10-03": 6.43,
    "2026-10-04": 14.27,
    "2026-10-05": 10.53,
    "2026-10-06": 10.52,
    "2026-10-07": 10.52,
    "2026-10-08": 10.5,
  };

  function buildWeekRows(skipIso?: string): NreRow[] {
    return Object.entries(spendByDay)
      .filter(([iso]) => iso !== skipIso)
      .map(([iso, spend]) => cloneRowForDay(template, iso, spend));
  }

  it("matches Ads Manager total (~74.61) when all 7 daily rows are present", () => {
    const rows = buildWeekRows();
    expect(validateWeeklyCsvDayRowsPresent(rows, weeklyRange, [CAMPAIGN]).ok).toBe(true);

    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW_OCT9,
    });
    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now: NOW_OCT9,
    });
    const weeklySpend = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric === "Amount spent",
    );
    expect(parseCellNum(weeklySpend?.reportDisplay ?? "")).toBeCloseTo(74.61, 0);
    expect(parseCellNum(weeklySpend?.csvDisplay ?? "")).toBeCloseTo(74.61, 0);
  });

  it("blocks under-count when Oct 2 is missing but the export still has earlier days", () => {
    const allRows = parseCsvText(readFileSync(FIXTURE, "utf8")).rows;
    const rowsWithoutOct2 = allRows.filter((r) => getRowDate(r) !== "2026-10-02");
    const coverage = validateWeeklyCsvDayRowsPresent(rowsWithoutOct2, weeklyRange, [CAMPAIGN]);
    expect(coverage.ok).toBe(false);
    expect(coverage.missingDays).toContain("2026-10-02");
  });

  it("documents Oct 3–8-only re-exports under-count vs a Oct 2–8 label (62.80 vs 74.61)", () => {
    const rows = buildWeekRows("2026-10-02");
    expect(validateWeeklyCsvDayRowsPresent(rows, weeklyRange, [CAMPAIGN]).ok).toBe(true);

    const report = buildReportData({
      accountName: "GZ",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      now: NOW_OCT9,
    });
    const verification = reconcileStandardReportWithCsv({
      report,
      mtdDailyRows: rows,
      selectedCampaigns: [CAMPAIGN],
      weeklyRange,
      reportType: "WEEKLY",
      timezone: TZ,
      currencySymbol: "A$",
      now: NOW_OCT9,
    });
    const weeklySpend = verification.checks.find(
      (c) => c.scope === "Weekly (last 7 days)" && c.metric === "Amount spent",
    );
    expect(parseCellNum(weeklySpend?.reportDisplay ?? "")).toBeCloseTo(62.8, 0);
  });
});
