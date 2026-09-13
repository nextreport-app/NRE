import { describe, expect, it } from "vitest";
import { buildGoogleCombinedTotalTableGrid } from "../google-combined-total";
import type { TableHeaderLabels, TableRowData } from "../report-data";

function emptyRow(): TableRowData {
  return {
    hasData: false,
    monthLabel: "—",
    fullMonthLabel: "—",
    monthName: null,
    sameMonthAsCurrentMTD: false,
    spend: "—",
    reach: "—",
    impressions: "—",
    ctr: "—",
    cpc: "—",
    resultColumns: [{ label: "CONVERSIONS", costLabel: "COST PER CONVERSION", value: "0", cprValue: "—" }],
  };
}

describe("buildGoogleCombinedTotalTableGrid", () => {
  it("returns header, mtd, then period rows matching Meta grid order", () => {
    const headers: TableHeaderLabels = { resultColumns: [{ label: "CONVERSIONS", costLabel: "COST PER CONVERSION" }] };
    const mtdRow: TableRowData = {
      ...emptyRow(),
      hasData: true,
      monthLabel: "Jul 1 - 19",
      spend: "$100",
      reach: "50",
      impressions: "1,000",
      ctr: "5%",
      cpc: "$2.00",
      resultColumns: [{ label: "CONVERSIONS", costLabel: "COST PER CONVERSION", value: "4", cprValue: "$25.00" }],
    };
    const grid = buildGoogleCombinedTotalTableGrid(emptyRow(), mtdRow, headers);
    expect(grid).toHaveLength(3);
    expect(grid[0][0]).toBe("Month");
    expect(grid[1][1]).toBe("$100");
    expect(grid[2][1]).toBe("—");
  });
});
