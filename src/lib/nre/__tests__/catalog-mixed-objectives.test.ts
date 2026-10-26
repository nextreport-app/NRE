import { describe, expect, it } from "vitest";
import { META_OBJECTIVE_SPECS } from "../meta-objective-dictionary";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
const now = new Date("2026-10-03T12:00:00Z");
const weeklyRange = { startIso: "2026-10-01", endIso: "2026-10-02" };
const expected = META_OBJECTIVE_SPECS.map((spec, index) => ({
  spec, name: `Campaign ${index + 1}`,
  count: spec.resultLabel === "REACH" ? 100 : spec.resultLabel === "IMPRESSIONS" ? 1000 : index + 1,
  // Hand-defined unit contract: only Reach and Impressions cost per 1,000.
  scale: ["REACH", "IMPRESSIONS"].includes(spec.resultLabel) ? 1000 : 1,
}));

function mixedCsv() {
  return [
    "Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions",
    ...expected.map(({ spec, name, count }) => [name, "Set A", "2026-10-01", spec.aliases[0], count, 100, 100, 1000].map(csvCell).join(",")),
  ].join("\n");
}

describe("all registered Meta objectives mixed across separate campaigns", () => {
  it("preserves every registered event and its own spend/count/rate without a three-objective cap", () => {
    const rows = parseCsvText(mixedCsv()).rows;
    const report = buildReportData({ accountName: "Catalogue matrix", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now, weeklyRange });
    expect(report.mtdRow.resultColumns).toHaveLength(expected.length);
    expect(report.campaignSlides).toHaveLength(expected.length);
    for (const { spec, name, count, scale } of expected) {
      const column = report.mtdRow.resultColumns.find(column => column.label === spec.resultLabel);
      expect(column, spec.key).toMatchObject({ value: count.toLocaleString("en-US"), cprValue: `$${(100 / count * scale).toFixed(2)}` });
      expect(report.mtdRow.accounting?.[spec.resultLabel], spec.key).toMatchObject({ spendBasis: 100, resultCount: count });
      const slide = report.campaignSlides.find(slide => slide.campaignName === name);
      expect(slide?.resultLabel, spec.key).toBe(spec.resultLabel);
      expect(slide?.metrics, spec.key).toMatchObject({ results: count.toLocaleString("en-US"), cpr: `$${(100 / count * scale).toFixed(2)}` });
    }
    const verification = reconcileStandardReportWithCsv({ report, mtdDailyRows: rows, reportType: "WEEKLY", timezone: "UTC", currencySymbol: "$", now, weeklyRange });
    expect(verification.checks.filter(check => check.status === "mismatch")).toEqual([]);
  });
});
