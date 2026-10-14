import { describe, expect, it } from "vitest";
import { isReturningImportClient } from "../import-download-instructions-state";

describe("isReturningImportClient", () => {
  it("treats any completed report as returning", () => {
    expect(isReturningImportClient({ baseline: null, completedReportCount: 1 })).toBe(true);
    expect(isReturningImportClient({ baseline: null, completedReportCount: 100 })).toBe(true);
  });

  it("treats a saved generate baseline as returning even with zero reports", () => {
    expect(
      isReturningImportClient({
        baseline: { savedAt: "2026-01-01T00:00:00.000Z" },
        completedReportCount: 0,
      }),
    ).toBe(true);
  });

  it("expands only for a brand-new client with no reports and no baseline", () => {
    expect(isReturningImportClient({ baseline: null, completedReportCount: 0 })).toBe(false);
  });
});
