import { describe, expect, it } from "vitest";
import { comparisonPresetPeriods } from "../comparison-period-selection";

describe("comparison periods before upload", () => {
  it("uses the last completed seven days and previous seven, independent of CSV dates", () => {
    expect(comparisonPresetPeriods("thisWeek", new Date("2026-10-31T12:00:00Z"), "UTC")).toEqual({ periodA: { startIso: "2026-10-24", endIso: "2026-10-30" }, periodB: { startIso: "2026-10-17", endIso: "2026-10-23" } });
  });
  it.each([15, 30] as const)("compares two consecutive %i-day windows with no overlap or gaps across year boundaries", days => {
    const periods = comparisonPresetPeriods(days === 15 ? "last15" : "last30", new Date("2026-01-15T12:00:00Z"), "UTC");
    const length = (range: { startIso: string; endIso: string }) => (Date.parse(range.endIso) - Date.parse(range.startIso)) / 86400000 + 1;
    expect(length(periods.periodA)).toBe(days);
    expect(length(periods.periodB)).toBe(days);
    expect(periods.periodA.endIso).toBe("2026-01-14");
    expect(Date.parse(periods.periodA.startIso) - Date.parse(periods.periodB.endIso)).toBe(86400000);
  });
  it("uses the client timezone for the final completed day", () => {
    expect(comparisonPresetPeriods("last30", new Date("2026-10-31T20:00:00Z"), "Asia/Kolkata")).toEqual({ periodA: { startIso: "2026-10-02", endIso: "2026-10-31" }, periodB: { startIso: "2026-09-02", endIso: "2026-10-01" } });
  });
});
