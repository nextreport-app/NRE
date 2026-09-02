import { describe, expect, it } from "vitest";
import {
  computeCsvDateBounds,
  computeEffectiveYesterday,
  computeMonthComparisonRangeOptions,
  computeMtdRangeIso,
  computeWeeklyRangeOptions,
  toIsoDate,
  validateCustomWeeklyRange,
} from "../date-range";
import type { NreRow } from "../columns";

function dailyRow(day: string): NreRow {
  return { _raw: { Day: day }, campaign_name: "Shoes" };
}

function daysInclusive(startIso: string, endIso: string): NreRow[] {
  const rows: NreRow[] = [];
  const start = new Date(startIso + "T00:00:00Z");
  const end = new Date(endIso + "T00:00:00Z");
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    const d = new Date(ts);
    const day = `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
    rows.push(dailyRow(day));
  }
  return rows;
}

describe("computeEffectiveYesterday", () => {
  it("is the latest CSV date when it's already before real yesterday", () => {
    const rows = daysInclusive("2026-07-01", "2026-07-20");
    const now = new Date("2026-07-25T12:00:00Z"); // real yesterday = Jul 24
    const yesterday = computeEffectiveYesterday(rows, now);
    expect(toIsoDate(yesterday!)).toBe("2026-07-20");
  });

  it("caps at real yesterday even if the CSV somehow has more recent (or today's) rows", () => {
    const rows = daysInclusive("2026-07-01", "2026-07-25"); // includes "today" and beyond
    const now = new Date("2026-07-25T12:00:00Z"); // real yesterday = Jul 24
    const yesterday = computeEffectiveYesterday(rows, now);
    expect(toIsoDate(yesterday!)).toBe("2026-07-24");
  });

  it("returns null when no row has a parseable date", () => {
    expect(computeEffectiveYesterday([{ _raw: {} }], new Date("2026-07-25T12:00:00Z"))).toBeNull();
  });
});

describe("computeWeeklyRangeOptions", () => {
  it("computes last7 (ending yesterday) and prev7 (the 7 days before that)", () => {
    const rows = daysInclusive("2026-07-01", "2026-07-24");
    const now = new Date("2026-07-25T12:00:00Z"); // yesterday = Jul 24
    const options = computeWeeklyRangeOptions(rows, now);
    expect(options.last7).toEqual({ startIso: "2026-07-18", endIso: "2026-07-24" });
    expect(options.prev7).toEqual({ startIso: "2026-07-11", endIso: "2026-07-17" });
  });

  it("handles a last7/prev7 window that crosses a month boundary", () => {
    const rows = daysInclusive("2026-06-20", "2026-07-03");
    const now = new Date("2026-07-04T12:00:00Z"); // calendar yesterday = Jul 3
    const options = computeWeeklyRangeOptions(rows, now);
    expect(options.last7).toEqual({ startIso: "2026-06-27", endIso: "2026-07-03" });
    expect(options.prev7).toEqual({ startIso: "2026-06-20", endIso: "2026-06-26" });
  });

  it("anchors last7 to calendar yesterday even when the CSV's latest row is earlier", () => {
    const rows = daysInclusive("2026-08-01", "2026-08-20");
    const now = new Date("2026-09-02T12:00:00Z");
    const options = computeWeeklyRangeOptions(rows, now, "America/Toronto");
    expect(options.last7).toEqual({ startIso: "2026-08-26", endIso: "2026-09-01" });
  });
});

describe("computeMtdRangeIso", () => {
  it("always starts on day 1 of the reporting month, regardless of the CSV's earliest row", () => {
    const rows = daysInclusive("2026-07-05", "2026-07-23"); // CSV starts mid-month
    const now = new Date("2026-07-24T12:00:00Z"); // yesterday = Jul 23
    expect(computeMtdRangeIso(rows, now)).toEqual({ startIso: "2026-07-01", endIso: "2026-07-23" });
  });

  it("anchors to the calendar month even when the CSV's latest row is still last month", () => {
    const rows = daysInclusive("2026-08-01", "2026-08-31");
    const now = new Date("2026-09-02T12:00:00Z");
    expect(computeMtdRangeIso(rows, now, "America/Toronto")).toEqual({ startIso: "2026-09-01", endIso: "2026-09-01" });
  });
});

describe("computeCsvDateBounds", () => {
  it("returns the actual min/max dates in the file, unaffected by 'yesterday' capping", () => {
    const rows = daysInclusive("2026-07-01", "2026-07-24");
    expect(computeCsvDateBounds(rows)).toEqual({ minIso: "2026-07-01", maxIso: "2026-07-24" });
  });

  it("returns null when there are no parseable dates", () => {
    expect(computeCsvDateBounds([{ _raw: {} }])).toBeNull();
  });
});

describe("validateCustomWeeklyRange", () => {
  const bounds = { minIso: "2026-07-01", maxIso: "2026-07-24" };

  it("accepts a range fully within the CSV's bounds and reports its span", () => {
    const result = validateCustomWeeklyRange("2026-07-10", "2026-07-16", bounds);
    expect(result).toEqual({ valid: true, spanDays: 7 });
  });

  it("rejects a range that starts before the CSV's earliest date", () => {
    const result = validateCustomWeeklyRange("2026-06-25", "2026-07-01", bounds);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("2026-07-01 to 2026-07-24");
  });

  it("rejects a range that ends after the CSV's latest date", () => {
    const result = validateCustomWeeklyRange("2026-07-20", "2026-07-30", bounds);
    expect(result.valid).toBe(false);
  });

  it("rejects a range where start is after end", () => {
    const result = validateCustomWeeklyRange("2026-07-16", "2026-07-10", bounds);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/before/i);
  });

  it("still validates (and reports a >7 span) for a custom range longer than a week", () => {
    // The >7-day warning is a soft UI confirmation, not a hard rejection —
    // this function just needs to report the true span so the caller can
    // decide whether to show it.
    const result = validateCustomWeeklyRange("2026-07-01", "2026-07-15", bounds);
    expect(result.valid).toBe(true);
    expect(result.spanDays).toBe(15);
  });
});

describe("computeMonthComparisonRangeOptions — Comparison Report's 'This month vs Last month' preset", () => {
  it("computes Period A = 1st of this month to yesterday, Period B = same span one month earlier", () => {
    const rows = daysInclusive("2026-07-01", "2026-08-06");
    const now = new Date("2026-08-07T12:00:00Z"); // real yesterday = Aug 6
    const result = computeMonthComparisonRangeOptions(rows, now);
    expect(result).not.toBeNull();
    expect(result!.periodA).toEqual({ startIso: "2026-08-01", endIso: "2026-08-06" });
    expect(result!.periodB).toEqual({ startIso: "2026-07-01", endIso: "2026-07-06" });
  });

  it("clamps Period B's end date to the shorter previous month instead of overflowing (e.g. Mar 31 -> Feb 28)", () => {
    const rows = daysInclusive("2026-02-01", "2026-03-31");
    const now = new Date("2026-04-01T12:00:00Z"); // real yesterday = Mar 31
    const result = computeMonthComparisonRangeOptions(rows, now);
    expect(result).not.toBeNull();
    expect(result!.periodA).toEqual({ startIso: "2026-03-01", endIso: "2026-03-31" });
    // February 2026 is not a leap year -> 28 days, so Period B clamps to Feb 28 instead of a nonexistent Feb 31.
    expect(result!.periodB).toEqual({ startIso: "2026-02-01", endIso: "2026-02-28" });
  });

  it("wraps across a year boundary (January -> December of the previous year)", () => {
    const rows = daysInclusive("2025-12-01", "2026-01-10");
    const now = new Date("2026-01-11T12:00:00Z"); // real yesterday = Jan 10
    const result = computeMonthComparisonRangeOptions(rows, now);
    expect(result).not.toBeNull();
    expect(result!.periodA).toEqual({ startIso: "2026-01-01", endIso: "2026-01-10" });
    expect(result!.periodB).toEqual({ startIso: "2025-12-01", endIso: "2025-12-10" });
  });

  it("returns null when there's no usable date data at all", () => {
    const result = computeMonthComparisonRangeOptions([], new Date("2026-08-07T12:00:00Z"));
    expect(result).toBeNull();
  });
});
