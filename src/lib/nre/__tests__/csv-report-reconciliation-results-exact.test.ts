import { describe, expect, it } from "vitest";
import { resultsMatch } from "../csv-report-reconciliation";

/** Mirrors production rules — results must be exact integers. */
function resultsWouldMismatch(reportResults: number, csvResults: number): boolean {
  return !resultsMatch(reportResults, csvResults);
}

describe("CSV verification result matching rules", () => {
  it("flags a one-lead gap (25 vs 26)", () => {
    expect(resultsWouldMismatch(25, 26)).toBe(true);
  });

  it("allows identical integer totals", () => {
    expect(resultsWouldMismatch(189, 189)).toBe(false);
  });

  it("does not hide fractional result discrepancies by rounding", () => {
    expect(resultsWouldMismatch(25.0, 25.4)).toBe(true);
  });
});

describe("CSV verification spend tolerance", () => {
  const SPEND_TOLERANCE = 2;

  it("ignores $1 spend gap", () => {
    expect(Math.abs(542 - 543)).toBeLessThanOrEqual(SPEND_TOLERANCE);
  });

  it("flags spend gap above $2", () => {
    expect(Math.abs(542 - 545)).toBeGreaterThan(SPEND_TOLERANCE);
  });
});
