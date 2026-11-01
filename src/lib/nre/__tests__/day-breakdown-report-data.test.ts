import { describe, expect, it } from "vitest";
import {
  buildDayBreakdownReportData,
  paginateDayBreakdownRows,
  validateDayBreakdownReportInput,
  DAY_BREAKDOWN_ROWS_PER_SLIDE,
} from "../day-breakdown-report-data";
import { buildDayBreakdownShareReportData } from "../share-report";
import type { NreRow } from "../columns";

function dailyRow(iso: string, campaign: string, spend: string, results = "5"): NreRow {
  return {
    campaign_name: campaign,
    ad_set_name: "Set 1",
    spend,
    reach: "100",
    impressions: "1000",
    results,
    ctr: "1",
    cpc: "0.5",
    date_start: iso,
    date_end: iso,
    _raw: { Day: iso, Spend: spend, Results: results, "Result type": "Website leads" },
  };
}

describe("buildDayBreakdownReportData", () => {
  it("builds one account row per day and paginates table slides", () => {
    const rows: NreRow[] = [
      dailyRow("2026-06-20", "Shoes", "10"),
      dailyRow("2026-06-21", "Shoes", "12"),
      dailyRow("2026-06-22", "Shoes", "8"),
    ];

    const coverage = validateDayBreakdownReportInput(rows, { startIso: "2026-06-20", endIso: "2026-06-22" });
    expect(coverage.valid).toBe(true);

    const data = buildDayBreakdownReportData({
      accountName: "Acme",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: rows,
      dateRange: { startIso: "2026-06-20", endIso: "2026-06-22" },
    });

    expect(data.isPaused).toBe(false);
    expect(data.dayCount).toBe(3);
    expect(data.dayRows).toHaveLength(3);
    expect(data.dayRows[0].monthLabel).toContain("Jun");
    expect(data.tableSlides).toHaveLength(1);

    const manyRows: NreRow[] = [];
    for (let day = 1; day <= 10; day += 1) {
      manyRows.push(dailyRow(`2026-06-${String(day).padStart(2, "0")}`, "Shoes", "10"));
    }
    const paginated = buildDayBreakdownReportData({
      accountName: "Acme",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: manyRows,
      dateRange: { startIso: "2026-06-01", endIso: "2026-06-10" },
    });
    expect(paginated.tableSlides).toHaveLength(2);
    expect(paginated.tableSlides[0]).toHaveLength(DAY_BREAKDOWN_ROWS_PER_SLIDE);
    expect(paginated.tableSlides[1]).toHaveLength(2);
  });

  it("returns paused when the selected range has no spend", () => {
    const data = buildDayBreakdownReportData({
      accountName: "Acme",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: [dailyRow("2026-06-01", "Shoes", "10")],
      dateRange: { startIso: "2026-06-20", endIso: "2026-06-22" },
    });
    expect(data.isPaused).toBe(true);
    expect(data.tableSlides).toHaveLength(0);
  });
});

describe("paginateDayBreakdownRows", () => {
  it("chunks rows at the configured slide size", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      hasData: true,
      monthLabel: `Day ${i + 1}`,
      fullMonthLabel: `Day ${i + 1}`,
      monthName: null,
      sameMonthAsCurrentMTD: false,
      spend: "$1",
      reach: "1",
      impressions: "1",
      ctr: "1%",
      cpc: "$1",
      resultColumns: [{ label: "RESULTS", costLabel: "COST PER RESULT", value: "1", cprValue: "$1" }],
    }));
    expect(paginateDayBreakdownRows(rows, 8)).toHaveLength(2);
  });
});

describe("buildDayBreakdownShareReportData", () => {
  it("maps day rows onto historicalComparisonRows for the share table", () => {
    const data = buildDayBreakdownReportData({
      accountName: "Acme",
      currencySymbol: "$",
      timezone: "UTC",
      mtdDailyRows: [dailyRow("2026-06-20", "Shoes", "10")],
      dateRange: { startIso: "2026-06-20", endIso: "2026-06-20" },
    });
    const share = buildDayBreakdownShareReportData(data);
    expect(share.reportType).toBe("DAY_BREAKDOWN");
    expect(share.historicalComparisonRows).toHaveLength(1);
    expect(share.visibility?.combinedTotal).toBe(true);
  });
});

import { dailyPresetRange, dailyPeriodLabel, dailyRangeLabel } from "../daily-period-selection";
describe("daily presets and complete exports", () => {
  const now = new Date("2026-11-01T06:00:00Z");
  it.each([1, 7, 14, 30])("keeps all %i selected days across table pages", days => {
    const range = dailyPresetRange(days, now, "Asia/Kolkata");
    expect(range.endIso).toBe("2026-10-31");
    expect(dailyPeriodLabel(range, now, "Asia/Kolkata")).toBe(days === 1 ? "Yesterday" : `Last ${days} days`);
    const rows = Array.from({ length: days }, (_, index) => {
      const date = new Date(`${range.startIso}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index);
      return dailyRow(date.toISOString().slice(0, 10), "Campaign", "10");
    });
    const data = buildDayBreakdownReportData({ accountName: "Acme", currencySymbol: "$", timezone: "Asia/Kolkata", mtdDailyRows: rows, dateRange: range, now });
    expect(data.tableSlides.flat()).toHaveLength(days);
    expect(data.tableSlides).toHaveLength(Math.ceil(days / 8));
    expect(data.periodLabel).toBe(dailyPeriodLabel(range, now, "Asia/Kolkata"));
  });
  it("honours the objective confirmed in the campaign step", () => {
    const data = buildDayBreakdownReportData({ accountName: "Acme", currencySymbol: "$", timezone: "UTC", mtdDailyRows: [dailyRow("2026-10-31", "Campaign", "10")], dateRange: { startIso: "2026-10-31", endIso: "2026-10-31" }, campaignObjectives: { Campaign: { resultLabel: "REACH", costLabel: "COST PER 1,000 PEOPLE REACHED" } } });
    expect(data.tableHeaderLabels.resultColumns.map(column => column.label)).toContain("REACH");
    expect(data.tableHeaderLabels.resultColumns.map(column => column.label)).not.toContain("WEBSITE LEADS");
  });
  it("keeps both years in a custom range", () => {
    const range = { startIso: "2025-12-30", endIso: "2026-01-02" };
    expect(dailyRangeLabel(range)).toContain("2025");
    expect(dailyRangeLabel(range)).toContain("2026");
    expect(dailyPeriodLabel(range, now)).toBe("Custom date range");
  });
});
