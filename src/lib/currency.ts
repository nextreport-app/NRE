/**
 * Pricing-currency detection for /pricing — pure mapping logic, kept
 * separate from the client component that calls ipapi.co so the "which
 * currency does this country get" rule is unit-testable without a real
 * network call or a browser DOM.
 */

export type PricingCurrency = "INR" | "USD";

/** India shows INR; every other country (US, CA, UK/GB, AU, all of Europe, everyone else) shows USD — see the /pricing spec's exact wording. */
export function countryCodeToCurrency(countryCode: string | null | undefined): PricingCurrency {
  return countryCode?.trim().toUpperCase() === "IN" ? "INR" : "USD";
}
