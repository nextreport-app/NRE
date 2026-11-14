import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { getRowDate } from "../columns";

describe("website lead Results precedence — self-contained daily fixture", () => {
  // The original test depended on a developer's private upload directory.
  // Reproduce its accounting contract with generated, non-client data.
  const lines = ["Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Website leads,Reach,Impressions"];
  for (let i = 0; i < 30; i++) {
    const day = new Date(Date.UTC(2026, 7, 17 + i)).toISOString().slice(0, 10);
    const results = i < 3 ? 2 : i < 26 ? 1 : 0;
    lines.push(`Example Website Leads,Main,${day},${i === 29 ? 11 : 10},${results},Website leads,${results + 5},100,200`);
  }
  const { rows } = parseCsvText(lines.join("\n"));

  const sepRows = rows.filter((r) => {
    const d = getRowDate(r);
    return d >= "2026-09-01" && d <= "2026-09-15";
  });

  const last30Rows = rows.filter((r) => {
    const d = getRowDate(r);
    return d >= "2026-08-17" && d <= "2026-09-15";
  });

  it("counts 11 website leads for Sep 1–15 (Results column, not inflated Website leads column)", () => {
    const data = buildReportData({
      accountName: "Ascend",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: sepRows,
      now: new Date("2026-09-16T12:00:00Z"),
    });
    const wlCol = data.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS");
    expect(wlCol?.value).toBe("11");
    expect(data.chart?.campaigns[0]?.results).toBe(11);
  });

  it("counts 29 website leads on the last-30-days chart slide (Aug 17–Sep 15)", () => {
    const data = buildReportData({
      accountName: "Ascend",
      currencySymbol: "$",
      timezone: "UTC",
      monthlyBudget: null,
      mtdDailyRows: last30Rows,
      now: new Date("2026-09-16T12:00:00Z"),
    });
    expect(data.chart?.campaigns[0]?.results).toBe(29);
    expect(data.chart?.totalAllSpend).toBeCloseTo(301, 0);
  });
});
