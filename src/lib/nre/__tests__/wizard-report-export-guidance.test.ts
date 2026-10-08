import { describe, expect, it } from "vitest";
import { wizardExportGuidanceForReportType } from "../wizard-report-export-guidance";

describe("wizardExportGuidanceForReportType", () => {
  it("weekly Meta mid-month asks for Last 30 Days and 7-day deck note", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "WEEKLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines.some((b) => /Last 30 Days/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /7-day slide/i.test(b))).toBe(true);
    expect(g.context).toMatch(/Weekly report/i);
  });

  it("monthly Meta mid-month does not default to Last 30 Days only", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/1st of this month/i);
    expect(g.lines.some((b) => /Time breakdown: Day/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /Last 30 Days only if/i.test(b))).toBe(true);
  });

  it("monthly Meta on the 1st asks for Previous Month", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(g.lines.some((b) => /Previous Month/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /not a trailing Last 30/i.test(b))).toBe(true);
  });

  it("yesterday report does not require Last 30 Days", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAILY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines.some((b) => /Last 7 Days/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /do not need Last 30/i.test(b))).toBe(true);
  });

  it("comparison Meta mentions both periods in one file", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "COMPARISON",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.context).toMatch(/both periods/i);
    expect(g.lines.some((b) => /Period A and B/i.test(b))).toBe(true);
  });

  it("day breakdown table focuses on chosen days not generic Last 30", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAY_BREAKDOWN",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.lines[0]).toMatch(/every day you want/i);
    expect(g.lines.some((b) => /Last 30 Days only if/i.test(b))).toBe(true);
  });
});
