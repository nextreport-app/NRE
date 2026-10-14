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

  it("monthly Meta on the 1st forbids MTD-style export", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(g.lines.some((b) => /no month-to-date yet/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /Previous Month/i.test(b))).toBe(true);
    expect(g.context).toMatch(/Monthly Performance Report/i);
  });

  it("monthly Meta mid-month asks for 1st through yesterday", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/1st of this month/i);
  });

  it("yesterday on the 1st mentions previous-month last day", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAILY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/last day of the previous month/i);
  });

  it("monthly Meta on the last day clarifies through-yesterday vs closed month", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-31T12:00:00Z"),
    });
    expect(g.lines.some((b) => /last calendar day/i.test(b))).toBe(true);
  });

  it("day-by-day table uses distinct download context label", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAY_BREAKDOWN",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.context).toMatch(/Day-by-Day Table Report/i);
  });
});
