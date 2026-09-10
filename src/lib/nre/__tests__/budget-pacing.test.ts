import { describe, expect, it } from "vitest";
import { buildBudgetSummary, budgetPacingWarning, budgetReferenceNote } from "../budget-pacing";

describe("buildBudgetSummary", () => {
  it("returns empty when cover pacing is disabled", () => {
    expect(buildBudgetSummary(5000, 100000, "₹", { showOnCover: false })).toBe("");
  });

  it("returns empty when no budget is set", () => {
    expect(buildBudgetSummary(5000, null, "₹", { showOnCover: true })).toBe("");
  });

  it("returns pacing line when enabled and in budget", () => {
    const line = buildBudgetSummary(25000, 100000, "₹", { showOnCover: true });
    expect(line).toContain("Monthly Ad Budget");
    expect(line).toContain("25%");
  });

  it("uses over-budget wording instead of extreme percentages", () => {
    const line = buildBudgetSummary(3000, 1000, "₹", { showOnCover: true });
    expect(line).toContain("over");
    expect(line).not.toContain("300%");
  });
});

describe("budgetReferenceNote", () => {
  it("returns note when budget is set but cover pacing is off", () => {
    const note = budgetReferenceNote(50000, false, "₹");
    expect(note).toContain("₹50,000");
    expect(note).toMatch(/not shown on the cover/i);
  });

  it("returns null when cover pacing is on", () => {
    expect(budgetReferenceNote(50000, true, "₹")).toBeNull();
  });
});

describe("budgetPacingWarning", () => {
  it("warns when pacing is on but budget missing", () => {
    expect(budgetPacingWarning(1000, null, true)).toMatch(/no monthly budget/i);
  });

  it("warns when spend exceeds budget", () => {
    expect(budgetPacingWarning(3000, 1000, true)).toMatch(/update the reference budget/i);
  });
});
