import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import type { ColumnMap, NreRow } from "../columns";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import { buildHistoricalReportData } from "../historical-report-data";

const client = { id: "test", userId: "test", accountName: "Test", currency: "USD", timezone: "UTC", monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
function row(iso: string, spend: number): NreRow {
  return { campaign_name: "Traffic", ad_set_name: "Set", spend: String(spend), impressions: "1000", reach: "100", results: "20", result_type: "Landing page views", link_clicks: "30", clicks: "40", ctr: "4", cpc: String(spend / 40), date_start: iso, date_end: iso, _raw: { Day: iso, "Result type": "Landing page views" } };
}
function rowsForMonth(month: number) {
  return Array.from({ length: new Date(2026, month, 0).getDate() }, (_, d) => row(`2026-${String(month).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`, month));
}
afterEach(() => vi.useRealTimers());
describe("selected report output", () => {
  it.each(["MONTHLY", "DAILY"])("%s preview and verification use only the selected source window", async type => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const rows = [...rowsForMonth(8), ...rowsForMonth(9), row("2026-10-26", 999)];
    const form = new FormData(); form.set("reportType", JSON.stringify(type));
    form.set("dateSelection", JSON.stringify({ mode: "custom", customStart: type === "MONTHLY" ? "2026-09-01" : "2026-09-14", customEnd: type === "MONTHLY" ? "2026-09-30" : "2026-09-14" }));
    form.set("includePreviousMonthComparison", "true");
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: { colMap: {} as ColumnMap, rows, headers: ["Day"] }, formData: form });
    expect(result).toHaveProperty("data");
    if (!("data" in result)) throw new Error(result.error);
    expect(result.data.mtdRow.spend).toBe(type === "MONTHLY" ? "$270" : "$9");
    expect(result.data.periodRow.hasData).toBe(false);
    const verified = verifyStandardWizardReportAgainstCsv({ client, platform: "META", mtdRows: rows, report: result.data, reportType: result.data.reportType, formData: form });
    expect(verified.checks.filter(c => c.status === "mismatch")).toEqual([]);
  });
  it("builds six distinct monthly totals rather than a single six-month sum", () => {
    const rows = [4, 5, 6, 7, 8, 9].flatMap(rowsForMonth);
    const data = buildHistoricalReportData({ accountName: "Test", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, monthCount: 6, now: new Date("2026-10-27T12:00:00Z") });
    expect(data.comparisonRows).toHaveLength(6);
    expect(data.comparisonRows.map(r => r.spend)).toEqual(["$120", "$155", "$180", "$217", "$248", "$270"]);
  });
  it("labels the partial final historical month MTD and rejects a missing middle month", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    const selection = { mode: "custom" as const, customStart: "2026-08-01", customEnd: "2026-10-26" };
    const rows = [...rowsForMonth(8), ...rowsForMonth(9), ...rowsForMonth(10).slice(0, 26)];
    const data = buildHistoricalReportData({ accountName: "Test", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, monthCount: 3, dateSelection: selection, now });
    expect(data.comparisonRows[2].monthLabel).toBe("October 2026 (MTD)");
    expect(data.comparisonRows[2].spend).toBe("$260");
    expect(data.slides.at(-1)?.performanceHeader).toContain("MTD");
    expect(() => buildHistoricalReportData({ accountName: "Test", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: [...rowsForMonth(8), ...rowsForMonth(10).slice(0, 26)], monthCount: 3, dateSelection: selection, now })).toThrow(/September/);
  });
  it("rejects a truncated selected month before building a report", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const form = new FormData(); form.set("reportType", JSON.stringify("MONTHLY"));
    form.set("dateSelection", JSON.stringify({ mode: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" }));
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: { colMap: {} as ColumnMap, rows: rowsForMonth(9).slice(5), headers: ["Day"] }, formData: form });
    expect(result).toEqual({ error: expect.stringContaining("CSV must cover 2026-09-01 through 2026-09-30") });
  });

});
