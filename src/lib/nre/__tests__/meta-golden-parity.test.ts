import { describe, expect, it, vi, afterEach } from "vitest";
import { buildReportData, buildComparisonReportData } from "../report-data";
import { buildHistoricalReportData } from "../historical-report-data";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { computeCsvDateBounds } from "../date-range";
import {
  apiRowsFromManual,
  assertStandardReportParity,
  loadFixtureCsv,
  resultColumn,
} from "./golden-parity-helpers";

const NOW = new Date("2026-09-24T12:00:00Z");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Meta golden parity — DC Credit Firm (website leads)", () => {
  const FIXTURE = "dc-credit-firm-weekly-upload.csv";
  const CAMPAIGN = "DC Leads Campaign Main";
  const TZ = "America/New_York";
  const RANGE = { sinceIso: "2026-08-25", untilIso: "2026-09-23" };
  const base = {
    accountName: "Credit Firm",
    currencySymbol: "$",
    timezone: TZ,
    monthlyBudget: null,
    now: NOW,
    selectedCampaigns: [CAMPAIGN],
  };

  async function reportsFor(reportType: "WEEKLY" | "MONTHLY" | "DAILY", extra: Record<string, unknown> = {}) {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const opts = { ...base, mtdDailyRows: manualRows, reportType, ...extra };
    return {
      manual: buildReportData({ ...opts, mtdDailyRows: manualRows }),
      api: buildReportData({ ...opts, mtdDailyRows: apiRows }),
    };
  }

  it("WEEKLY — manual CSV matches API-sync on website leads, CPL, and chart", async () => {
    const { manual, api } = await reportsFor("WEEKLY", {
      weeklyRange: { startIso: "2026-08-25", endIso: "2026-09-23" },
    });
    assertStandardReportParity(manual, api, "WEBSITE LEADS");
    expect(resultColumn(manual, "WEBSITE LEADS")?.value).toBe("9");
  });

  it("MONTHLY — manual CSV matches API-sync on MTD website leads", async () => {
    const { manual, api } = await reportsFor("MONTHLY");
    assertStandardReportParity(manual, api, "WEBSITE LEADS");
  });

  it("DAILY (Yesterday) — single-day window, zero leads on Sep 23, not weekly totals", async () => {
    const yesterday = { startIso: "2026-09-23", endIso: "2026-09-23" };
    const { manual, api } = await reportsFor("DAILY", { weeklyRange: yesterday });

    assertStandardReportParity(manual, api, "WEBSITE LEADS");
    expect(manual.mtdRow.spend).toBe(api.mtdRow.spend);
    expect(resultColumn(manual, "WEBSITE LEADS")?.value).toBe("0");
    expect(manual.chart?.actualPeriodDays).toBe(1);
    expect(manual.chart?.periodSubLabel).toBe("Sep 23, 2026");
    // Must not bleed in the full-period weekly/MTD lead count.
    expect(resultColumn(manual, "WEBSITE LEADS")?.value).not.toBe("9");
  });

  it("COMPARISON — period A/B totals match between manual and API rows", async () => {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const input = {
      accountName: base.accountName,
      currencySymbol: base.currencySymbol,
      timezone: TZ,
      selectedCampaigns: [CAMPAIGN],
      periodA: { startIso: "2026-09-01", endIso: "2026-09-15" },
      periodB: { startIso: "2026-08-16", endIso: "2026-08-31" },
      now: NOW,
    };
    const manual = buildComparisonReportData({ ...input, mtdDailyRows: manualRows });
    const api = buildComparisonReportData({ ...input, mtdDailyRows: apiRows });
    expect(api.totals.metricsA.spend).toStrictEqual(manual.totals.metricsA.spend);
    expect(api.totals.metricsB.spend).toStrictEqual(manual.totals.metricsB.spend);
    expect(api.campaigns[0]?.metricsA.results).toStrictEqual(manual.campaigns[0]?.metricsA.results);
    expect(api.campaigns[0]?.metricsB.results).toStrictEqual(manual.campaigns[0]?.metricsB.results);
  });

  it("HISTORICAL — month comparison rows match between manual and API rows", async () => {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const input = {
      accountName: base.accountName,
      currencySymbol: base.currencySymbol,
      timezone: TZ,
      monthlyBudget: null,
      mtdDailyRows: manualRows,
      monthCount: 2,
      selectedCampaigns: [CAMPAIGN],
      now: NOW,
    };
    const manual = buildHistoricalReportData(input);
    const api = buildHistoricalReportData({ ...input, mtdDailyRows: apiRows });
    expect(api.comparisonRows.length).toBe(manual.comparisonRows.length);
    manual.comparisonRows.forEach((row, i) => {
      expect(api.comparisonRows[i]?.spend).toBe(row.spend);
      expect(api.comparisonRows[i]?.resultColumns[0]?.value).toBe(row.resultColumns[0]?.value);
    });
  });

  it("DAY_BREAKDOWN — per-day spend rows match between manual and API rows", async () => {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const dateRange = { startIso: "2026-09-17", endIso: "2026-09-23" };
    const input = {
      accountName: base.accountName,
      currencySymbol: base.currencySymbol,
      timezone: TZ,
      mtdDailyRows: manualRows,
      dateRange,
      selectedCampaigns: [CAMPAIGN],
      now: NOW,
    };
    const manual = buildDayBreakdownReportData(input);
    const api = buildDayBreakdownReportData({ ...input, mtdDailyRows: apiRows });
    expect(api.dayRows.length).toBe(manual.dayRows.length);
    manual.dayRows.forEach((row, i) => {
      expect(api.dayRows[i]?.spend).toBe(row.spend);
      expect(api.dayRows[i]?.monthLabel).toBe(row.monthLabel);
    });
  });
});

describe("Meta golden parity — GZ Australia (instant form leads)", () => {
  const FIXTURE = "gz-australia-lead-forms.csv";
  const CAMPAIGN = "GZ Australia | Lead Forms | Top Funnel | A3HD";
  const TZ = "Australia/Sydney";
  const bounds = computeCsvDateBounds(loadFixtureCsv(FIXTURE));
  const RANGE = { sinceIso: bounds!.minIso, untilIso: bounds!.maxIso };

  it("WEEKLY — manual CSV matches API-sync on instant form leads", async () => {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const opts = {
      accountName: "GZ Australia",
      currencySymbol: "A$",
      timezone: TZ,
      monthlyBudget: null,
      now: new Date("2026-09-17T12:00:00Z"),
      selectedCampaigns: [CAMPAIGN],
      weeklyRange: { startIso: "2026-09-10", endIso: "2026-09-16" },
    };
    const manual = buildReportData({ ...opts, mtdDailyRows: manualRows, reportType: "WEEKLY" });
    const api = buildReportData({ ...opts, mtdDailyRows: apiRows, reportType: "WEEKLY" });
    assertStandardReportParity(manual, api, "META FORM LEADS");
  });
});

describe("Meta golden parity — Southaven (multi-objective: Reach + Link clicks)", () => {
  const FIXTURE = "southaven-weekly.csv";
  const TZ = "America/Chicago";
  const bounds = computeCsvDateBounds(loadFixtureCsv(FIXTURE));
  const RANGE = { sinceIso: bounds!.minIso, untilIso: bounds!.maxIso };

  it("WEEKLY — manual CSV matches API-sync spend and per-campaign results", async () => {
    const manualRows = loadFixtureCsv(FIXTURE);
    const apiRows = await apiRowsFromManual(manualRows, RANGE, TZ);
    const opts = {
      accountName: "Southaven RV",
      currencySymbol: "$",
      timezone: TZ,
      monthlyBudget: null,
      now: NOW,
      weeklyRange: { startIso: "2026-09-17", endIso: "2026-09-23" },
    };
    const manual = buildReportData({ ...opts, mtdDailyRows: manualRows, reportType: "WEEKLY" });
    const api = buildReportData({ ...opts, mtdDailyRows: apiRows, reportType: "WEEKLY" });

    expect(api.mtdRow.spend).toBe(manual.mtdRow.spend);
    expect(api.campaignSlides.length).toBe(manual.campaignSlides.length);
    manual.campaignSlides.forEach((slide, i) => {
      expect(api.campaignSlides[i]?.metrics.spend).toBe(slide.metrics.spend);
      expect(api.campaignSlides[i]?.metrics.results).toBe(slide.metrics.results);
      expect(api.campaignSlides[i]?.resultLabel).toBe(slide.resultLabel);
    });
    if (manual.chart && api.chart) {
      expect(api.chart.totalAllSpend).toBe(manual.chart.totalAllSpend);
    }
  });
});
