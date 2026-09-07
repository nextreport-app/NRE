import { describe, expect, it } from "vitest";
import {
  formatClientTimezone,
  formatMonthlyBudget,
  formatRelativeReportDate,
  getPreviousMonthListStatus,
} from "@/lib/client-display";

describe("client-display", () => {
  it("formats common timezones readably", () => {
    expect(formatClientTimezone("America/New_York")).toBe("Eastern Time");
    expect(formatClientTimezone("Asia/Kolkata")).toBe("India");
    expect(formatClientTimezone("Europe/Berlin")).toBe("Berlin");
  });

  it("hides budget when unset", () => {
    expect(formatMonthlyBudget("USD", null)).toBeNull();
    expect(formatMonthlyBudget("USD", 5000)).toBe("$5,000 / month");
  });

  it("formats relative report dates", () => {
    const now = new Date("2026-09-07T12:00:00Z");
    expect(formatRelativeReportDate("2026-09-07T10:00:00Z", now)).toBe("Today");
    expect(formatRelativeReportDate("2026-09-03T10:00:00Z", now)).toBe("4 days ago");
  });

  it("flags stale previous month data", () => {
    const status = getPreviousMonthListStatus(true, "2026-08-15T00:00:00.000Z", "UTC", new Date("2026-09-07T12:00:00Z"));
    expect(status.status).toBe("stale");
    expect(status.label).toContain("refresh");
  });
});
