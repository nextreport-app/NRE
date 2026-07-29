import { describe, expect, it } from "vitest";
import { countryCodeToCurrency } from "../currency";

describe("countryCodeToCurrency", () => {
  it("maps India to INR", () => {
    expect(countryCodeToCurrency("IN")).toBe("INR");
  });

  it("is case-insensitive", () => {
    expect(countryCodeToCurrency("in")).toBe("INR");
  });

  it("tolerates surrounding whitespace", () => {
    expect(countryCodeToCurrency(" IN ")).toBe("INR");
  });

  it.each(["US", "CA", "GB", "AU", "DE", "FR", "NZ", "SG", "ZZ"])(
    "maps %s to USD",
    (code) => {
      expect(countryCodeToCurrency(code)).toBe("USD");
    },
  );

  it("defaults to USD when the country cannot be detected (null, undefined, or empty)", () => {
    expect(countryCodeToCurrency(null)).toBe("USD");
    expect(countryCodeToCurrency(undefined)).toBe("USD");
    expect(countryCodeToCurrency("")).toBe("USD");
  });
});
