import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { validateMtdDailyCsv } from "../validate";

const FIXTURE = resolve(__dirname, "fixtures/dc-leads-campaigns-table-oct2026.csv");

describe("validate — DC Campaigns table Breakdown: Day export", () => {
  it("does not flag date_granularity for equal Reporting starts/ends per row", () => {
    const { colMap, rows, headers } = parseCsvText(readFileSync(FIXTURE, "utf8"));
    const result = validateMtdDailyCsv(colMap, rows, new Date("2026-10-21T12:00:00Z"), headers, "META");
    expect(result.errors.some((e) => e.field === "date_granularity")).toBe(false);
    expect(result.valid).toBe(true);
  });
});
