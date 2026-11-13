import { describe, expect, it } from "vitest";
import {
  isWeeklyShareReportType,
  reportingWeekLabel,
  WEEKLY_REPORT_SCOPE_LINE,
  weeklyReportScopeLine,
} from "../weekly-report-labels";

describe("weekly report labels", () => {
  it("formats reporting week with range", () => {
    expect(reportingWeekLabel("October 10 - October 16")).toBe(
      "Reporting period: October 10 - October 16",
    );
  });

  it("handles empty range", () => {
    expect(reportingWeekLabel("  ")).toBe("Reporting period");
  });

  it("detects weekly share report type", () => {
    expect(isWeeklyShareReportType("WEEKLY")).toBe(true);
    expect(isWeeklyShareReportType("MONTHLY")).toBe(false);
  });

  it("uses last 7 days only for a seven-day saved reporting window", () => {
    expect(weeklyReportScopeLine("11/06/2026 to 11/12/2026", "2026-11-13T12:00:00Z")).toContain("last 7 days");
    expect(weeklyReportScopeLine("12/29/2026 to 01/04/2027", "2027-01-05T12:00:00Z")).toContain("last 7 days");
    for (const range of ["10/30/2026 to 11/12/2026", "10/01/2026 to 10/07/2026", "invalid", ""]) {
      expect(weeklyReportScopeLine(range, "2026-11-13T12:00:00Z")).toContain("reporting period");
      expect(weeklyReportScopeLine(range, "2026-11-13T12:00:00Z")).not.toContain("last 7 days");
    }
  });
  it("scope line is non-empty", () => {
    expect(WEEKLY_REPORT_SCOPE_LINE.length).toBeGreaterThan(20);
  });
});
