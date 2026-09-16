import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const CSV_PATH = "/home/ubuntu/.cursor/projects/workspace/uploads/DC-weekly-Mentee_0944.csv";

describe("Mentee CSV — website leads match Results column", () => {
  const { rows } = parseCsvText(readFileSync(CSV_PATH, "utf8"));

  const sepRows = rows.filter((r) => {
    const d = r.date_start || "";
    return d >= "2026-09-01" && d <= "2026-09-15";
  });

  const last30Rows = rows.filter((r) => {
    const d = r.date_start || "";
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
