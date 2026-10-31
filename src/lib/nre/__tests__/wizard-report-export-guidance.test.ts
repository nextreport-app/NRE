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

  it("monthly supports a selected month even on the first", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(g.lines.some((b) => /selected month/i.test(b))).toBe(true);
    expect(g.lines.some((b) => /Choose Day-wise breakdown/i.test(b))).toBe(true);
    expect(g.context).toMatch(/Monthly report/i);
  });

  it("monthly Meta mid-month asks for 1st through yesterday", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-08T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/1st through the last completed day/i);
  });

  it("daily guidance describes one selected day", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAILY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-01T12:00:00Z"),
    });
    expect(g.lines[0]).toMatch(/selected day/i);
  });

  it("monthly Meta on the last day clarifies through-yesterday vs closed month", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "MONTHLY",
      platform: "META",
      clientTimezone: "UTC",
      now: new Date("2026-10-31T12:00:00Z"),
    });
    expect(g.lines.some((b) => /last completed day/i.test(b))).toBe(true);
  });

  it("day-by-day table uses distinct download context label", () => {
    const g = wizardExportGuidanceForReportType({
      reportType: "DAY_BREAKDOWN",
      platform: "META",
      clientTimezone: "UTC",
    });
    expect(g.context).toMatch(/Daily report/i);
  });
});
