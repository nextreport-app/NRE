import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";

describe("parseCsvText", () => {
  it("parses headers and auto-maps known columns", () => {
    const csv = [
      "Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type",
      "Shoes,Prospecting,19-07-2026,100,5,Purchase",
      "Shoes,Retargeting,19-07-2026,50,2,Purchase",
    ].join("\n");

    const { colMap, rows, headers } = parseCsvText(csv);
    expect(headers).toEqual([
      "Campaign name",
      "Ad set name",
      "Day",
      "Amount spent (USD)",
      "Results",
      "Result type",
    ]);
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(colMap.spend).toBe("Amount spent (USD)");
    expect(rows).toHaveLength(2);
    expect(rows[0].campaign_name).toBe("Shoes");
    expect(rows[0]._raw["Day"]).toBe("19-07-2026");
  });

  it("returns empty result for empty input", () => {
    expect(parseCsvText("")).toEqual({ colMap: {}, rows: [], headers: [] });
  });

  it("handles quoted fields with embedded commas", () => {
    const csv = 'Campaign name,Amount spent (USD)\n"Shoes, Sale Edition",100';
    const { rows } = parseCsvText(csv);
    expect(rows[0].campaign_name).toBe("Shoes, Sale Edition");
  });
});
