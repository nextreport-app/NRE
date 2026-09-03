import { describe, expect, it } from "vitest";
import { computeLastNDaysIsoRange } from "../api-date-range";
import { formatDayForCsv, isoToCsvDay, rowsToCsv } from "../rows-to-csv";

describe("rowsToCsv", () => {
  it("serializes headers and rows with quoting when needed", () => {
    const csv = rowsToCsv(
      ["Campaign name", "Day"],
      [
        ["Shoes", "19-07-2026"],
        ['Campaign, "special"', "20-07-2026"],
      ],
    );
    expect(csv).toBe(
      'Campaign name,Day\nShoes,19-07-2026\n"Campaign, ""special""",20-07-2026',
    );
  });
});

describe("isoToCsvDay", () => {
  it("converts ISO dates to DD-MM-YYYY", () => {
    expect(isoToCsvDay("2026-07-19")).toBe("19-07-2026");
    expect(formatDayForCsv(2026, 7, 1)).toBe("01-07-2026");
  });
});

describe("computeLastNDaysIsoRange", () => {
  it("returns 30 inclusive days ending today in the client timezone", () => {
    const now = new Date("2026-07-20T12:00:00Z");
    const { sinceIso, untilIso } = computeLastNDaysIsoRange(now, "UTC", 30);
    expect(untilIso).toBe("2026-07-20");
    expect(sinceIso).toBe("2026-06-21");
  });
});
