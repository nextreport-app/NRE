import { describe, expect, it } from "vitest";
import { buildBudgetSummary } from "../budget-pacing";

describe("buildBudgetSummary", () => {
  it("returns empty when no budget is set", () => {
    expect(buildBudgetSummary(5000, null, "₹")).toBe("");
  });

  it("returns pacing line when budget and spend are present", () => {
    const line = buildBudgetSummary(25000, 100000, "₹");
    expect(line).toContain("Monthly Ad Budget");
    expect(line).toContain("25%");
  });
});
