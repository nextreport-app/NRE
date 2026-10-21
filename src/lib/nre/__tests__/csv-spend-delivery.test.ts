import { describe, expect, it } from "vitest";
import { readRowsWithAutoMap } from "../columns";
import { classifyCsvSpendDelivery } from "../csv-spend-delivery";
import { validateMtdDailyCsv } from "../validate";

describe("csv-spend-delivery", () => {
  it("classifies delivery without spend as broken_export", () => {
    const { colMap, rows } = readRowsWithAutoMap(
      ["Campaign name", "Day", "Amount spent (USD)", "Impressions", "Results", "Result type"],
      [
        ["Camp", "2026-10-14", "0", "500", "2", "Leads"],
        ["Camp", "2026-10-15", "", "300", "0", ""],
      ],
    );
    expect(classifyCsvSpendDelivery(colMap, rows, "META")).toBe("broken_export");
    const validation = validateMtdDailyCsv(colMap, rows, new Date("2026-10-20T12:00:00Z"), [], "META");
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.field === "spend" && e.message.includes("Campaigns"))).toBe(true);
  });

  it("classifies zero spend and zero delivery as no_delivery (warning only)", () => {
    const { colMap, rows } = readRowsWithAutoMap(
      ["Campaign name", "Day", "Amount spent (USD)", "Impressions", "Results", "Result type"],
      [
        ["Camp", "2026-10-14", "0", "0", "0", "Leads"],
        ["Camp", "2026-10-15", "0", "", "", ""],
      ],
    );
    expect(classifyCsvSpendDelivery(colMap, rows, "META")).toBe("no_delivery");
    const validation = validateMtdDailyCsv(colMap, rows, new Date("2026-10-20T12:00:00Z"), [], "META");
    expect(validation.valid).toBe(true);
    expect(validation.warnings.some((w) => w.field === "spend" && w.message.includes("paused"))).toBe(true);
  });

  it("passes when any row has spend", () => {
    const { colMap, rows } = readRowsWithAutoMap(
      ["Campaign name", "Day", "Amount spent (USD)", "Impressions"],
      [["Camp", "2026-10-14", "12.5", "100"]],
    );
    expect(classifyCsvSpendDelivery(colMap, rows, "META")).toBe("has_spend");
  });
});
