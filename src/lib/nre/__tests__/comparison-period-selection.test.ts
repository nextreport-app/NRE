import { describe, expect, it } from "vitest";
import { comparisonPresetPeriods } from "../comparison-period-selection";

describe("comparison periods before upload", () => {
  it("uses the last completed seven days and previous seven, independent of CSV dates", () => {
    expect(comparisonPresetPeriods("thisWeek", new Date("2026-10-31T12:00:00Z"), "UTC")).toEqual({ periodA: { startIso: "2026-10-24", endIso: "2026-10-30" }, periodB: { startIso: "2026-10-17", endIso: "2026-10-23" } });
  });
  it("offers the two complete calendar months, including at a year boundary", () => {
    expect(comparisonPresetPeriods("thisMonth", new Date("2026-01-15T12:00:00Z"), "UTC")).toEqual({ periodA: { startIso: "2025-12-01", endIso: "2025-12-31" }, periodB: { startIso: "2025-11-01", endIso: "2025-11-30" } });
  });
  it("uses the client calendar when it is already the first of the next month", () => {
    expect(comparisonPresetPeriods("thisMonth", new Date("2026-10-31T20:00:00Z"), "Asia/Kolkata").periodA).toEqual({ startIso: "2026-10-01", endIso: "2026-10-31" });
  });
});
