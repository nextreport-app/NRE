import { describe, expect, it } from "vitest";
import {
  formatReportAutoRemoveDate,
  formatReportGeneratedAt,
  reportHistoryMetaSubtitle,
} from "@/lib/report-list-shared";

describe("report-list-shared", () => {
  it("formats generated timestamp in client timezone", () => {
    const line = formatReportGeneratedAt("2026-10-14T10:30:00.000Z", "America/Chicago");
    expect(line).toMatch(/Oct 14, 2026/);
    expect(line).toMatch(/5:30/);
  });

  it("builds history subtitle with period and auto-remove date", () => {
    const meta = reportHistoryMetaSubtitle(
      {
        createdAt: "2026-10-14T10:30:00.000Z",
        reportType: "WEEKLY",
        weekStart: "10/07/2026",
        weekEnd: "10/13/2026",
      },
      { timeZone: "UTC", retentionDays: 7 },
    );
    expect(meta.generatedLine).toMatch(/^Generated /);
    expect(meta.detailLine).toContain("Report period:");
    expect(meta.detailLine).toContain("Auto-removes");
    expect(meta.detailLine).toMatch(/Oct 21, 2026/);
  });

  it("computes auto-remove date from retention window", () => {
    expect(formatReportAutoRemoveDate("2026-10-14T00:00:00.000Z", 7, "UTC")).toBe("Oct 21, 2026");
  });
});
