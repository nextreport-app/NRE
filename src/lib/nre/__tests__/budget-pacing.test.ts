import { describe, expect, it } from "vitest";
import {
  buildBudgetCoverPreview,
  buildBudgetSummary,
  budgetPacingWarning,
  monthDaysRemaining,
} from "../budget-pacing";

describe("buildBudgetSummary", () => {
  it("returns empty when cover pacing is disabled", () => {
    expect(buildBudgetSummary(5000, 100000, "₹", { showOnCover: false })).toBe("");
  });

  it("returns empty when no budget is set", () => {
    expect(buildBudgetSummary(5000, null, "₹", { showOnCover: true })).toBe("");
  });

  it("returns pacing line when enabled and in budget", () => {
    const line = buildBudgetSummary(25000, 100000, "₹", { showOnCover: true, timezone: "UTC" });
    expect(line).toContain("Monthly Ad Budget");
    expect(line).toContain("25%");
    expect(line).toContain("days remaining");
  });

  it("uses over-budget wording instead of extreme percentages", () => {
    const line = buildBudgetSummary(3000, 1000, "₹", { showOnCover: true, timezone: "UTC" });
    expect(line).toContain("over");
    expect(line).not.toContain("300%");
  });
});

describe("buildBudgetCoverPreview", () => {
  it("shows a preview even when cover toggle is off", () => {
    const line = buildBudgetCoverPreview(25000, 100000, "₹", "UTC");
    expect(line).toContain("Monthly Ad Budget");
    expect(line).toContain("₹25,000");
  });

  it("returns null when no budget is set", () => {
    expect(buildBudgetCoverPreview(1000, null, "₹", "UTC")).toBeNull();
  });
});

describe("monthDaysRemaining", () => {
  it("returns non-negative days", () => {
    expect(monthDaysRemaining("Asia/Kolkata", new Date("2026-09-11T12:00:00Z"))).toBeGreaterThanOrEqual(0);
  });
});

describe("budgetPacingWarning", () => {
  it("warns when pacing is on but budget missing", () => {
    expect(budgetPacingWarning(1000, null, true)).toMatch(/set a monthly budget/i);
  });

  it("warns when spend exceeds budget", () => {
    expect(budgetPacingWarning(3000, 1000, true)).toMatch(/turn off the cover toggle/i);
  });
});

it("omits the current-month countdown for a completed reporting month in both cover and preview", () => {
  const asOf = new Date("2026-11-20T12:00:00Z");
  const expected = "Monthly Ad Budget: $2,081.26 of $3,000 used (69%)";
  expect(buildBudgetSummary(2081.26, 3000, "$", {showOnCover:true,timezone:"UTC",asOf,reportMonthIso:"2026-10"})).toBe(expected);
  expect(buildBudgetCoverPreview(2081.26,3000,"$","UTC",asOf,"2026-10")).toBe(expected);
  expect(buildBudgetCoverPreview(0,3000,"$","UTC",asOf,"2026-10")).not.toContain("days remaining");
  expect(buildBudgetSummary(4000,3000,"$",{showOnCover:true,timezone:"UTC",asOf,reportMonthIso:"2026-10"})).not.toContain("days remaining");
});

it("keeps current-month pacing and compares reporting months in the client timezone", () => {
  const asOf = new Date("2026-11-20T12:00:00Z");
  expect(buildBudgetSummary(1000,3000,"$",{showOnCover:true,timezone:"UTC",asOf,reportMonthIso:"2026-11"})).toContain("10 days remaining");
  const boundary = new Date("2026-11-01T00:30:00Z");
  expect(buildBudgetSummary(1000,3000,"$",{showOnCover:true,timezone:"America/Los_Angeles",asOf:boundary,reportMonthIso:"2026-10"})).toContain("0 days remaining");
  expect(buildBudgetSummary(1000,3000,"$",{showOnCover:true,timezone:"Asia/Kolkata",asOf:boundary,reportMonthIso:"2026-10"})).not.toContain("days remaining");
});
