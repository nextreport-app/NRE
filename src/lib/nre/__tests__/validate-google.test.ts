import { describe, expect, it } from "vitest";
import { buildGoogleColumnMap, readGoogleRowsWithAutoMap } from "../google-columns";
import { validateGoogleAdsCsv } from "../validate-google";

const NOW = new Date("2026-07-20T12:00:00Z");

function parse(headers: string[], dataRows: string[][]) {
  const colMap = buildGoogleColumnMap(headers);
  const { rows } = readGoogleRowsWithAutoMap(headers, dataRows);
  return { colMap, rows };
}

describe("validateGoogleAdsCsv", () => {
  it("passes for a well-formed Google Ads CSV", () => {
    const headers = ["Campaign", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC"];
    const { colMap, rows } = parse(headers, [["Shoes - Search", "13-07-2026", "100", "50", "3000", "1.5%", "2.00"]]);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("reports each required column missing individually", () => {
    const headers = ["Something Else"];
    const { colMap, rows } = parse(headers, [["x"]]);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field);
    expect(fields).toContain("campaign_name");
    expect(fields).toContain("cost");
    expect(fields).toContain("clicks");
    expect(fields).toContain("impressions");
    expect(fields).toContain("ctr");
    expect(fields).toContain("avg_cpc");
    expect(fields).toContain("date");
  });

  it("every missing-column message points to the Download Guide", () => {
    const headers: string[] = [];
    const { colMap, rows } = parse(headers, []);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    const columnErrors = result.errors.filter((e) => e.field !== "rows" && e.field !== "diagnostic");
    for (const e of columnErrors) {
      expect(e.message).toContain("Download Guide");
    }
  });

  it("fails with the no-data-rows message when the CSV has a header but no data rows", () => {
    const headers = ["Campaign", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC"];
    const { colMap, rows } = parse(headers, []);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "rows" && e.message.includes("Google Ads"))).toBe(true);
  });

  it("fails when every row has an empty campaign name", () => {
    const headers = ["Campaign", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC"];
    const { colMap, rows } = parse(headers, [["", "13-07-2026", "100", "50", "3000", "1.5%", "2.00"]]);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "campaign_name")).toBe(true);
  });

  it("flags a date range spanning more than 90 days", () => {
    const headers = ["Campaign", "Day", "Cost", "Clicks", "Impr.", "CTR", "Avg. CPC"];
    const { colMap, rows } = parse(headers, [
      ["Shoes - Search", "01-01-2026", "100", "50", "3000", "1.5%", "2.00"],
      ["Shoes - Search", "01-07-2026", "100", "50", "3000", "1.5%", "2.00"],
    ]);
    const result = validateGoogleAdsCsv(colMap, rows, NOW, headers);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "date" && e.message.includes("days"))).toBe(true);
  });
});
