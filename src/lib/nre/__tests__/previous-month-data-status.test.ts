import { describe, expect, it } from "vitest";
import { getPreviousMonthComparisonInfo } from "../previous-month-data-status";

describe("getPreviousMonthComparisonInfo", () => {
  it("returns missing when no file is stored", () => {
    const info = getPreviousMonthComparisonInfo(false, null, "UTC", new Date("2026-09-05T12:00:00Z"));
    expect(info.status).toBe("missing");
    expect(info.expectedMonthName).toBe("August");
  });

  it("returns current when uploaded this calendar month", () => {
    const info = getPreviousMonthComparisonInfo(
      true,
      "2026-09-03T10:00:00Z",
      "UTC",
      new Date("2026-09-05T12:00:00Z"),
    );
    expect(info.status).toBe("current");
    expect(info.expectedMonthName).toBe("August");
  });

  it("returns stale when last upload was before the current month began", () => {
    const info = getPreviousMonthComparisonInfo(
      true,
      "2026-08-28T10:00:00Z",
      "UTC",
      new Date("2026-09-05T12:00:00Z"),
    );
    expect(info.status).toBe("stale");
    expect(info.expectedMonthName).toBe("August");
  });

  it("uses the client timezone for month boundaries", () => {
    // Sep 1 03:00 UTC is still Aug 31 in US Eastern — August upload still "current" for August expectation... 
    // On Sep 1 Eastern, expected month is August; upload Sep 1 Eastern morning = current
    const info = getPreviousMonthComparisonInfo(
      true,
      "2026-09-01T14:00:00Z",
      "America/New_York",
      new Date("2026-09-01T14:00:00Z"),
    );
    expect(info.status).toBe("current");
    expect(info.expectedMonthName).toBe("August");
  });
});
