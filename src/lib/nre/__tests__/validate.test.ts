import { describe, expect, it } from "vitest";
import { validateMtdDailyCsv } from "../validate";
import { readRowsWithAutoMap } from "../columns";

const NOW = new Date("2026-07-20T12:00:00Z");

function parse(headers: string[], rows: string[][]) {
  return readRowsWithAutoMap(headers, rows);
}

describe("validateMtdDailyCsv", () => {
  it("passes for a well-formed CSV", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Ad set name", "Day", "Amount spent (USD)", "Results", "Result type"],
      [["Shoes", "Set 1", "19-07-2026", "100", "5", "Purchase"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails when required columns are missing", () => {
    const { colMap, rows } = parse(["Some Column"], [["x"]]);
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("campaign_name");
    expect(fields).toContain("spend");
    expect(fields).toContain("results");
  });

  it("fails when every campaign name is empty", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [["", "19-07-2026", "100", "5"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "campaign_name")).toBe(true);
  });

  it("fails when dates are in the future", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [["Shoes", "25-12-2026", "100", "5"]],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "date" && e.message.includes("future"))).toBe(true);
  });

  it("fails when the date range spans more than 90 days", () => {
    const { colMap, rows } = parse(
      ["Campaign name", "Day", "Amount spent (USD)", "Results"],
      [
        ["Shoes", "01-01-2026", "100", "5"],
        ["Shoes", "01-06-2026", "100", "5"],
      ],
    );
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "date" && e.message.includes("90 days"))).toBe(true);
  });

  it("fails on an empty CSV", () => {
    const { colMap, rows } = parse(["Campaign name", "Day", "Amount spent (USD)", "Results"], []);
    const result = validateMtdDailyCsv(colMap, rows, NOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "rows")).toBe(true);
  });
});
