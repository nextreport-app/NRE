import { describe, expect, it } from "vitest";
import {
  isWeeklyShareReportType,
  reportingWeekLabel,
  WEEKLY_REPORT_SCOPE_LINE,
} from "../weekly-report-labels";

describe("weekly report labels", () => {
  it("formats reporting week with range", () => {
    expect(reportingWeekLabel("October 10 - October 16")).toBe(
      "Reporting week: October 10 - October 16",
    );
  });

  it("handles empty range", () => {
    expect(reportingWeekLabel("  ")).toBe("Reporting week");
  });

  it("detects weekly share report type", () => {
    expect(isWeeklyShareReportType("WEEKLY")).toBe(true);
    expect(isWeeklyShareReportType("MONTHLY")).toBe(false);
  });

  it("scope line is non-empty", () => {
    expect(WEEKLY_REPORT_SCOPE_LINE.length).toBeGreaterThan(20);
  });
});
