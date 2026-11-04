import { describe, expect, it } from "vitest";
import { reportDeliverySummary } from "../report-delivery-summary";
describe("report email period labels", () => {
  it.each([
    ["WEEKLY", "Weekly"],
    ["MONTHLY", "Monthly"],
    ["HISTORICAL", "Multi-month"],
    ["DAY_BREAKDOWN", "Daily"],
  ])("uses saved %s period", (reportType, label) => {
    expect(
      reportDeliverySummary({
        reportType,
        weekStart: null,
        weekEnd: null,
        summaryJson: JSON.stringify({ cover: { dateRange: "Sep 1–30, 2026" } }),
      }),
    ).toEqual({ reportType: label, dateRange: "Sep 1–30, 2026" });
  });
  it("includes both comparison periods and tolerates legacy JSON", () => {
    expect(
      reportDeliverySummary({
        reportType: "COMPARISON",
        weekStart: null,
        weekEnd: null,
        summaryJson: JSON.stringify({
          kind: "comparison",
          periodALabel: "September",
          periodBLabel: "August",
        }),
      }).dateRange,
    ).toBe("September vs August");
    expect(
      reportDeliverySummary({
        reportType: "MONTHLY",
        weekStart: "2026-09-01",
        weekEnd: "2026-09-30",
        summaryJson: "{",
      }).dateRange,
    ).toBe("2026-09-01 - 2026-09-30");
  });
});
