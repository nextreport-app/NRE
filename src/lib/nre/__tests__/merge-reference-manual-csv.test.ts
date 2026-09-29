import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { mergeApiCsvWithManualReference } from "../meta-api-sync/merge-reference-manual-csv";
import { rowsToCsv } from "../rows-to-csv";
import { META_CSV_HEADERS, insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-user-upload-sep2026.csv",
);

describe("mergeApiCsvWithManualReference", () => {
  it("restores manual Results when API mapper over-counts website leads", () => {
    const manualText = readFileSync(MANUAL, "utf8");
    const { rows: manualRows } = parseCsvText(manualText);

    const badApiRows = manualRows.map((row) => {
      const insight = manualRowToMetaInsight(row);
      insight.results = [{ indicator: "actions:lead", values: [{ value: "5" }] }];
      insight.cost_per_result = [{ indicator: "actions:lead", values: [{ value: "2.00" }] }];
      return insightToManualCsvRow(insight);
    });
    const badApiCsv = rowsToCsv([...META_CSV_HEADERS], badApiRows);

    const mergedText = mergeApiCsvWithManualReference(badApiCsv, manualText);
    const { rows: mergedRows } = parseCsvText(mergedText);

    const opts = {
      accountName: "Credit Firm",
      currencySymbol: "$",
      timezone: "America/New_York",
      monthlyBudget: null,
      now: new Date("2026-09-25T12:00:00Z"),
      reportType: "WEEKLY" as const,
      selectedCampaigns: ["DC Leads Campaign Main"],
      weeklyRange: { startIso: "2026-09-18", endIso: "2026-09-24" },
    };

    const manualReport = buildReportData({ ...opts, mtdDailyRows: manualRows });
    const mergedReport = buildReportData({ ...opts, mtdDailyRows: mergedRows });

    expect(mergedReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe("9");
    expect(mergedReport.chart?.campaigns[0]?.results).toBe(12);
    expect(mergedReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value).toBe(
      manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value,
    );
  });
});
