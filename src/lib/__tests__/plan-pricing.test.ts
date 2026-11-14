import { describe, expect, it } from "vitest";
import { amountForCurrency, formattedPlanPrice, isSupportedCheckoutAmount } from "../plan-pricing";

describe("shared checkout and display prices", () => {
  it.each([
    ["starter", "INR", 39900, 399000], ["professional", "INR", 99900, 999000], ["agency_plus", "INR", 169900, 1699000],
    ["starter", "USD", 500, 5000], ["professional", "USD", 1200, 12000], ["agency_plus", "USD", 2000, 20000],
  ] as const)("preserves %s %s charges and formats the exact annual amount", (plan, currency, monthly, annual) => {
    expect(amountForCurrency(plan, currency)).toBe(monthly);
    const display = formattedPlanPrice(plan, currency);
    expect(display).toContain(currency === "USD" ? "USD" : "₹");
    if (currency === "USD") expect(display).not.toContain("$");
    expect(amountForCurrency(plan, currency, "annual")).toBe(annual);
    expect(Number(formattedPlanPrice(plan, currency, "annual").replace(/[^\d.]/g, ""))).toBe(annual / 100);
  });
});

describe("existing checkout compatibility", () => {
  it("retains exact previous prices for existing recorded checkouts only", () => {
    expect(isSupportedCheckoutAmount("starter", "USD", "monthly", 900)).toBe(true);
    expect(isSupportedCheckoutAmount("professional", "INR", "annual", 1247040)).toBe(true);
    expect(isSupportedCheckoutAmount("agency_plus", "USD", "monthly", 1500)).toBe(false);
    expect(isSupportedCheckoutAmount("starter", "USD", "monthly", 1)).toBe(false);
  });
});
