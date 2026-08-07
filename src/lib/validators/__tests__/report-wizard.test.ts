import { describe, expect, it } from "vitest";
import { comparisonPeriodSchema, parseJsonFormField, reportTypeSchema } from "../report-wizard";

describe("reportTypeSchema", () => {
  it("accepts WEEKLY, MONTHLY, and COMPARISON", () => {
    expect(reportTypeSchema.safeParse("WEEKLY").success).toBe(true);
    expect(reportTypeSchema.safeParse("MONTHLY").success).toBe(true);
    expect(reportTypeSchema.safeParse("COMPARISON").success).toBe(true);
  });

  it("rejects an unknown report type", () => {
    expect(reportTypeSchema.safeParse("comparison").success).toBe(false); // case-sensitive
    expect(reportTypeSchema.safeParse("QUARTERLY").success).toBe(false);
  });
});

describe("comparisonPeriodSchema", () => {
  it("accepts a well-formed startIso/endIso pair", () => {
    const result = comparisonPeriodSchema.safeParse({ startIso: "2026-08-01", endIso: "2026-08-06" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing or blank field", () => {
    expect(comparisonPeriodSchema.safeParse({ startIso: "", endIso: "2026-08-06" }).success).toBe(false);
    expect(comparisonPeriodSchema.safeParse({ startIso: "2026-08-01" }).success).toBe(false);
    expect(comparisonPeriodSchema.safeParse({}).success).toBe(false);
  });
});

describe("parseJsonFormField — Comparison Report period fields", () => {
  it("round-trips comparisonPeriodA/B the same way dateSelection already does", () => {
    const formData = new FormData();
    formData.append("comparisonPeriodA", JSON.stringify({ startIso: "2026-08-01", endIso: "2026-08-06" }));
    formData.append("comparisonPeriodB", JSON.stringify({ startIso: "2026-07-01", endIso: "2026-07-06" }));

    const periodA = parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema);
    const periodB = parseJsonFormField(formData, "comparisonPeriodB", comparisonPeriodSchema);

    expect(periodA).toEqual({ startIso: "2026-08-01", endIso: "2026-08-06" });
    expect(periodB).toEqual({ startIso: "2026-07-01", endIso: "2026-07-06" });
  });

  it("returns undefined for an absent field", () => {
    const formData = new FormData();
    expect(parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema)).toBeUndefined();
  });

  it("returns undefined for a field that fails schema validation", () => {
    const formData = new FormData();
    formData.append("comparisonPeriodA", JSON.stringify({ startIso: "2026-08-01" })); // missing endIso
    expect(parseJsonFormField(formData, "comparisonPeriodA", comparisonPeriodSchema)).toBeUndefined();
  });
});
