import { describe, expect, it } from "vitest";
import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent, formatMetricValue, parseCellNum } from "../format";

describe("parseCellNum", () => {
  it("strips commas, currency symbols, percent signs and whitespace", () => {
    expect(parseCellNum("1,234.56")).toBe(1234.56);
    expect(parseCellNum("$99")).toBe(99);
    expect(parseCellNum("12%")).toBe(12);
    expect(parseCellNum(" 3.5 ")).toBe(3.5);
    // parseCellNum_ only ever strips [,$%\s] in the source (a single-currency
    // script) — it does not strip ₹ or other symbols. Raw CSV numeric columns
    // from Meta/Google exports are always plain numbers or $-prefixed
    // regardless of the client's configured display currency, so this never
    // comes up in practice; the test documents the exact ported behaviour.
    expect(parseCellNum("₹100000")).toBe(0);
    expect(parseCellNum("$1,00,000")).toBe(100000);
  });

  it("returns 0 for empty, nullish, or non-numeric input", () => {
    expect(parseCellNum("")).toBe(0);
    expect(parseCellNum("   ")).toBe(0);
    expect(parseCellNum(null)).toBe(0);
    expect(parseCellNum(undefined)).toBe(0);
    expect(parseCellNum("abc")).toBe(0);
  });

  it("passes numbers through unchanged", () => {
    expect(parseCellNum(1234.5)).toBe(1234.5);
    expect(parseCellNum(0)).toBe(0);
  });
});

describe("fmtCurrency", () => {
  it("rounds to whole units and comma-groups", () => {
    expect(fmtCurrency(1234.5, "$")).toBe("$1,235");
    expect(fmtCurrency(999, "₹")).toBe("₹999");
    expect(fmtCurrency(1000000, "$")).toBe("$1,000,000");
  });

  it("always includes the currency symbol, even at zero — never a bare '0'", () => {
    expect(fmtCurrency(0, "$")).toBe("$0");
    expect(fmtCurrency(0, "₹")).toBe("₹0");
    expect(fmtCurrency("", "$")).toBe("$0");
    expect(fmtCurrency(undefined, "$")).toBe("$0");
  });
});

describe("fmtCurrency2dp", () => {
  it("keeps 2 decimals WITHOUT comma grouping (matches fmtCurrency2dp_ exactly)", () => {
    expect(fmtCurrency2dp(12345.678, "$")).toBe("$12345.68");
    expect(fmtCurrency2dp(1.5, "₹")).toBe("₹1.50");
  });
});

describe("fmtNumber", () => {
  it("rounds and comma-groups", () => {
    expect(fmtNumber(1234.5)).toBe("1,235");
    expect(fmtNumber(0)).toBe("0");
  });
});

describe("fmtPercent", () => {
  it("formats to 2 decimals with a trailing %", () => {
    expect(fmtPercent(3.456)).toBe("3.46%");
    expect(fmtPercent(0)).toBe("0.00%");
  });
});

describe("formatMetricValue", () => {
  it("comma-groups currency values above 1,000 (unlike bare fmtCurrency2dp)", () => {
    expect(formatMetricValue(1350, "currency", "$")).toBe("$1,350.00");
    expect(formatMetricValue(221.69, "currency", "$")).toBe("$221.69");
  });

  it("dispatches number/percentage/duration/ratio/text to their own formatters", () => {
    expect(formatMetricValue(8400, "number", "$")).toBe("8,400");
    expect(formatMetricValue(1.955, "percentage", "$")).toBe("1.96%");
    expect(formatMetricValue(75, "duration", "$")).toBe("1m 15s");
    expect(formatMetricValue(2.5, "ratio", "$")).toBe("2.50x");
    expect(formatMetricValue("Search Campaign", "text", "$")).toBe("Search Campaign");
  });
});
