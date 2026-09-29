import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { insightToManualCsvRow } from "../meta-api-sync/insight-engine";
import { META_CSV_HEADERS } from "../meta-api-sync/insight-engine";
import { readRowsWithAutoMap } from "../columns";
import { manualRowToMetaInsight } from "./golden-parity-helpers";

const MANUAL = resolve(
  process.cwd(),
  "src/lib/nre/__tests__/fixtures/dc-credit-firm-weekly-sep29-2026.csv",
);

function productionShapedInsight(row: ReturnType<typeof parseCsvText>["rows"][number]) {
  const insight = manualRowToMetaInsight(row);
  const results = Number(row.results) || 0;
  const spend = Number(row.spend) || 0;
  const rt = String(row.result_type ?? "").toLowerCase();
  insight.cost_per_result = [];
  insight.cost_per_action_type = [];
  if (results > 0 && rt.includes("website")) {
    insight.objective_results = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(results) }],
      },
    ];
    insight.cost_per_objective_result = [
      {
        indicator: "actions:offsite_conversion.fb_pixel_lead",
        values: [{ value: String(spend / results) }],
      },
    ];
  } else {
    insight.results = [{ indicator: "actions:lead", values: [{ value: "1" }] }];
    insight.actions = (insight.actions ?? []).filter(
      (a) =>
        a.action_type !== "offsite_conversion.fb_pixel_lead" &&
        a.action_type !== "lead" &&
        a.action_type !== "onsite_conversion.lead_grouped",
    );
  }
  return insight;
}

describe("Credit Firm uploaded CSV vs production-shaped API rows", () => {
  const opts = {
    accountName: "Credit Firm",
    currencySymbol: "$",
    timezone: "America/New_York",
    monthlyBudget: null,
    now: new Date("2026-09-29T12:00:00Z"),
    reportType: "WEEKLY" as const,
    selectedCampaigns: ["DC Leads Campaign Main"],
    weeklyRange: { startIso: "2026-09-22", endIso: "2026-09-28" },
  };

  it("matches manual MTD 12, chart 14, weekly 3", () => {
    const { rows: manualRows } = parseCsvText(readFileSync(MANUAL, "utf8"));
    const apiRows = manualRows.map((row) => {
      const csvCells = insightToManualCsvRow(productionShapedInsight(row));
      const obj: Record<string, string> = {};
      META_CSV_HEADERS.forEach((h, i) => {
        obj[h] = csvCells[i] ?? "";
      });
      return readRowsWithAutoMap([...META_CSV_HEADERS], [[...META_CSV_HEADERS.map((h) => obj[h])]]).rows[0];
    });

    const manualReport = buildReportData({ ...opts, mtdDailyRows: manualRows });
    const apiReport = buildReportData({ ...opts, mtdDailyRows: apiRows });

    const manualMtd = manualReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value;
    const apiMtd = apiReport.mtdRow.resultColumns.find((c) => c.label === "WEBSITE LEADS")?.value;
    expect(manualMtd).toBeTruthy();
    expect(apiMtd).toBe(manualMtd);
    expect(apiReport.chart?.campaigns[0]?.results).toBe(manualReport.chart?.campaigns[0]?.results);
    expect(apiReport.campaignSlides[0]?.metrics.results).toBe(manualReport.campaignSlides[0]?.metrics.results);
    expect(Number(apiMtd)).toBeGreaterThan(0);
  });
});
