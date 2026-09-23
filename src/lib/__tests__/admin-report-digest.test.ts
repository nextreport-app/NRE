import { describe, expect, it } from "vitest";
import { formatDailyReportDigestEmail, istDayBoundsForDigest } from "../admin-report-digest";

describe("admin report daily digest", () => {
  it("uses the IST day that just ended at midnight IST", () => {
    // Sep 24, 2026 00:30 IST = Sep 23, 2026 19:00 UTC
    const bounds = istDayBoundsForDigest(new Date("2026-09-23T19:00:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-09-22T18:30:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-23T18:30:00.000Z");
  });

  it("formats a scannable digest without per-report lines", () => {
    const { subject, text } = formatDailyReportDigestEmail({
      dayLabel: "Sep 22, 2026",
      total: 3,
      activeUsers: 1,
      byUser: [
        {
          email: "vishnuhmkms@gmail.com",
          name: "Vishnu H",
          count: 3,
          clients: ["Acme Co", "Beta Ltd"],
        },
      ],
      byPlatform: { "Meta Ads": 2, GA4: 1 },
      byReportType: { WEEKLY: 2, WEBSITE: 1 },
    });

    expect(subject).toContain("3 reports");
    expect(text).toContain("vishnuhmkms@gmail.com");
    expect(text).toContain("Acme Co, Beta Ltd");
    expect(text).not.toContain("Share link");
    expect(text).not.toContain("Report ID");
  });

  it("handles zero-report days", () => {
    const { subject, text } = formatDailyReportDigestEmail({
      dayLabel: "Sep 22, 2026",
      total: 0,
      activeUsers: 0,
      byUser: [],
      byPlatform: {},
      byReportType: {},
    });

    expect(subject).toContain("0 reports");
    expect(text).toContain("No reports generated");
  });
});
