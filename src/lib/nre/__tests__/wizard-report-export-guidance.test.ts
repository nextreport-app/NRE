import { describe, expect, it } from "vitest";
import { wizardExportGuidanceForReportType } from "../wizard-report-export-guidance";

describe("wizardExportGuidanceForReportType", () => {
  it("weekly Meta keeps agreed copy (Last 30 + 7-day deck line)", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "WEEKLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/Last 30 Days with Day breakdown/i);
    expect(g.lines[1]).toMatch(
      /Weekly slides use the last 7-day period; the same file powers MTD, the last-30 chart, and pacing/i,
    );
    expect(g.lines).toHaveLength(2);
  });

  it("monthly Meta mid-month asks for month-to-date not generic Last 30 only", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/1st of this month/i);
    expect(g.lines.some((b) => /Last 30 Days is OK only if/i.test(b))).toBe(true);
  });

  it("yesterday report suggests Last 7 Days", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAILY",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.lines[0]).toMatch(/Last 7 Days/i);
  });
});
