import { describe, expect, it } from "vitest";
import { wizardExportGuidanceForReportType } from "../wizard-report-export-guidance";

describe("wizardExportGuidanceForReportType", () => {
  it("weekly Meta explains 30-day export vs 7-day deck period", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "WEEKLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines.some((b) => /Last 30 Days/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /last 7-day period/i.test(b))).toBe(true);
  });

  it("comparison Meta mentions both periods in one file", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "COMPARISON",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.title).toMatch(/both periods/i);
  });
});
