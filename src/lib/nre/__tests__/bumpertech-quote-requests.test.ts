import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { aggregateRows } from "../aggregate";
import { buildReportData } from "../report-data";
import { groupResultsByCampaignObjective, buildCampaignObjectiveMap, resultValueForObjective } from "../objective";
import { parseCellNum } from "../format";

const PM_CSV_PATH = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/bumpertech-aug-quote-requests.csv");
const MTD_CSV_PATH = resolve(process.cwd(), "src/lib/nre/__tests__/fixtures/bumpertech-sep-mtd-snippet.csv");

describe("BumperTech August Previous Month — Quote Request Submitted", () => {
  const { rows: periodRows } = parseCsvText(readFileSync(PM_CSV_PATH, "utf8"));
  const { rows: mtdAll } = parseCsvText(readFileSync(MTD_CSV_PATH, "utf8"));
  const mtdDailyRows = mtdAll.filter((r) => (r._raw?.Day as string | undefined)?.includes("-09-"));
  const totalQuotes = periodRows.reduce(
    (sum, r) => sum + (r.result_type?.toLowerCase().includes("quote") ? parseCellNum(r.results) : 0),
    0,
  );

  it("CSV fixture has 148 quote requests across August daily rows", () => {
    expect(totalQuotes).toBe(148);
  });

  it("resultValueForObjective counts Quote Request Submitted rows toward QUOTE REQUESTS even when campaign names say website leads", () => {
    const sample = periodRows.find((r) => r.result_type === "Quote Request Submitted");
    expect(sample).toBeTruthy();
    expect(resultValueForObjective(sample!, "QUOTE REQUESTS")).toBe(parseCellNum(sample!.results));
  });

  it("Previous Month Combined Total row matches spend and quote count from the CSV", () => {
    const data = buildReportData({
      accountName: "BumperTech",
      currencySymbol: "A$",
      timezone: "Australia/Sydney",
      monthlyBudget: null,
      mtdDailyRows,
      periodRows,
      now: new Date("2026-09-18T12:00:00Z"),
      reportType: "MONTHLY",
    });

    const col = data.periodRow.resultColumns.find((c) => c.label === "QUOTE REQUESTS");
    expect(data.periodRow.spend).toBe("A$1,635");
    expect(col?.value).toBe(String(totalQuotes));
    // CPR uses quote-attributed spend only (excludes zero-quote days in lead campaigns).
    expect(col?.cprValue).toBe("A$8.52");
  });

  it("groupResultsByCampaignObjective totals all quote rows when the map uses QUOTE REQUESTS from aggregated MTD", () => {
    const map = buildCampaignObjectiveMap([...aggregateRows(mtdDailyRows), ...periodRows]);
    const groups = groupResultsByCampaignObjective(periodRows, map);
    const quotes = groups.find((g) => g.label === "QUOTE REQUESTS");
    expect(quotes?.count).toBe(totalQuotes);
  });
});
