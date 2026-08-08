import { describe, it, expect } from "vitest";
import { defaultReportDisplayName } from "../report-display-name";

describe("defaultReportDisplayName", () => {
  it("builds 'Weekly — <range>' for a WEEKLY report", () => {
    expect(defaultReportDisplayName("WEEKLY", "07/30/2026", "08/05/2026")).toBe("Weekly — July 30 - August 5");
  });

  it("builds 'Monthly — <range>' for a MONTHLY report", () => {
    expect(defaultReportDisplayName("MONTHLY", "07/01/2026", "07/31/2026")).toBe("Monthly — July 1 - July 31");
  });

  it("falls back to just the type label when weekStart/weekEnd are missing", () => {
    expect(defaultReportDisplayName("WEEKLY", null, null)).toBe("Weekly");
    expect(defaultReportDisplayName("MONTHLY", undefined, undefined)).toBe("Monthly");
  });

  it("builds 'Comparison — <periodLabel>' for a COMPARISON report", () => {
    expect(defaultReportDisplayName("COMPARISON", null, null, "This Week vs Last Week")).toBe(
      "Comparison — This Week vs Last Week",
    );
  });

  it("falls back to just 'Comparison' when no periodLabel is given", () => {
    expect(defaultReportDisplayName("COMPARISON", null, null)).toBe("Comparison");
  });
});
