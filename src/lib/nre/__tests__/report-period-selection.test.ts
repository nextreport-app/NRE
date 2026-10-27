import { describe, expect, it } from "vitest";
import { historicalPeriods, monthPeriod, reportCalendarYesterday, reportPeriodAnchor, selectedSinglePeriod } from "../report-period-selection";
import { computeHistoricalMonthRanges, validateHistoricalCsvCoverage } from "../date-range";
import { getCalendarDateInTimezone } from "../dates";

const now = new Date("2026-10-27T12:00:00Z");
describe("report periods", () => {
  it("uses MTD and yesterday by default, not a week", () => {
    expect(selectedSinglePeriod("MONTHLY", undefined, now)).toEqual({ startIso: "2026-10-01", endIso: "2026-10-26" });
    expect(selectedSinglePeriod("DAILY", undefined, now)).toEqual({ startIso: "2026-10-26", endIso: "2026-10-26" });
  });
  it("accepts a completed month and a different single day", () => {
    expect(selectedSinglePeriod("MONTHLY", { mode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" }, now)?.endIso).toBe("2026-09-30");
    expect(selectedSinglePeriod("DAILY", { mode: "custom", customStart: "2026-09-14", customEnd: "2026-09-14" }, now)?.startIso).toBe("2026-09-14");
  });
  it("rejects partial closed months, multiple days, future days and malformed dates", () => {
    for (const [type, start, end] of [["MONTHLY", "2026-09-01", "2026-09-15"], ["DAILY", "2026-09-01", "2026-09-02"], ["DAILY", "2026-10-28", "2026-10-28"], ["DAILY", "2026-02-30", "2026-02-30"]]) {
      expect(() => selectedSinglePeriod(type, { mode: "custom", customStart: start, customEnd: end }, now)).toThrow();
    }
  });
  it("defaults to the month that just closed on the first", () => {
    expect(selectedSinglePeriod("MONTHLY", undefined, new Date("2026-10-01T12:00:00Z"))).toEqual({ startIso: "2026-09-01", endIso: "2026-09-30" });
    expect(computeHistoricalMonthRanges(3, new Date("2026-10-01T12:00:00Z")).map(r => r.fullMonthLabel)).toEqual(["July 2026", "August 2026", "September 2026"]);
  });
  it("offers 3/6 complete months and explicit MTD without silently mixing them", () => {
    expect(historicalPeriods(3, undefined, false, now).map(r => r.startIso)).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    const six = historicalPeriods(6, undefined, false, now);
    expect(six[0].startIso).toBe("2026-04-01");
    expect(six[5].endIso).toBe("2026-09-30");
    const partial = historicalPeriods(3, "2026-10", true, now);
    expect(partial[2].fullMonthLabel).toBe("October 2026 (MTD)");
    expect(partial[2].endIso).toBe("2026-10-26");
    expect(() => historicalPeriods(3, "2026-10", false, now)).toThrow();
  });
  it("anchors historical months correctly even in UTC+14", () => {
    for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles", "Asia/Kolkata"]) {
      expect(reportCalendarYesterday(reportPeriodAnchor("2026-09-30", zone), zone)).toBe("2026-09-30");
      expect(getCalendarDateInTimezone(reportPeriodAnchor("2026-09-30", zone), zone).day).toBe(1);
    }
  });
  it("rejects truncated month coverage instead of treating overlap as a full month", () => {
    const ranges = historicalPeriods(3, undefined, false, now);
    expect(validateHistoricalCsvCoverage({ minIso: "2026-07-15", maxIso: "2026-09-20" }, ranges).valid).toBe(false);
    expect(validateHistoricalCsvCoverage({ minIso: "2026-07-01", maxIso: "2026-09-30" }, ranges).valid).toBe(true);
  });
  it("handles leap February", () => {
    expect(monthPeriod("2024-02", now).endIso).toBe("2024-02-29");
  });
});
