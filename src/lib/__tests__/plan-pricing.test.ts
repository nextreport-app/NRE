import { describe, expect, it } from "vitest";
import { amountForCurrency, formattedPlanPrice } from "../plan-pricing";

describe("shared checkout and display prices", () => {
  it.each([
    ["starter", "INR", 79900, 767040], ["professional", "INR", 129900, 1247040],
    ["starter", "USD", 900, 8640], ["professional", "USD", 1500, 14400],
  ] as const)("preserves %s %s charges and formats the exact annual amount", (plan, currency, monthly, annual) => {
    expect(amountForCurrency(plan, currency)).toBe(monthly);
    expect(amountForCurrency(plan, currency, "annual")).toBe(annual);
    expect(Number(formattedPlanPrice(plan, currency, "annual").replace(/[^\d.]/g, ""))).toBe(annual / 100);
  });
});
