import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import { parseCsvText } from "../parse-csv";
import { alignCsvComparison, alignCsvRange, alignCsvReportFormData, csvReportNow, csvReportingCalendar, completeCsvBounds } from "../csv-reporting-calendar";
import { computeWizardUploadDateContext } from "../wizard-upload-date-context";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { resolveDateSelection } from "../resolve-date-selection";
import { buildDayBreakdownReportData } from "../day-breakdown-report-data";
import { buildComparisonReportData } from "../report-data";
import { buildHistoricalReportData, validateHistoricalReportInput } from "../historical-report-data";
import { comparisonPresetPeriods } from "../comparison-period-selection";
import { validateComparisonReportCoverage } from "../comparison-coverage";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import { reconcileDayBreakdownReportWithCsv, reconcileComparisonReportWithCsv, reconcileHistoricalReportWithCsv } from "../csv-report-reconciliation";
import { CsvReportingDateNote } from "@/components/report-upload-wizard/ui/csv-reporting-date-note";
const now = new Date("2026-11-02T06:00:00Z"), timezone = "Asia/Kolkata";
function csv(start: string, count: number) {
  const first = Date.parse(start + "T12:00:00Z");
  return parseCsvText(`Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Impressions,Reach,Clicks (all),Link clicks\n${Array.from({ length: count }, (_, index) => `Example,Example set,${new Date(first + index * 86400000).toISOString().slice(0,10)},10,2,Website leads,1000,100,40,20`).join("\n")}`);
}
const parsed = csv("2026-10-02", 30);
const bounds = { minIso: "2026-10-02", maxIso: "2026-10-31" };
const client = { id: "test", userId: "test", accountName: "Example", timezone, currency: "USD", monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
const base = { accountName: "Example", timezone, currencySymbol: "$", monthlyBudget: null, mtdDailyRows: parsed.rows, now };
function form(type: string, start?: string, end?: string) { const data = new FormData(); data.set("reportType", JSON.stringify(type)); data.set("dateSelection", JSON.stringify(start ? { mode: "custom", customStart: start, customEnd: end } : { mode: "last7" })); return data; }
describe("CSV-first reporting cutoff", () => {
  it.each([1,7,14,30])("shifts the full %i-day window instead of dropping the oldest day", days => {
    const oldStart = new Date(Date.parse("2026-11-01T12:00:00Z") - (days - 1) * 86400000).toISOString().slice(0,10);
    const range = alignCsvRange({ startIso: oldStart, endIso: "2026-11-01" }, bounds, "DAY_BREAKDOWN", now, timezone);
    expect(range.endIso).toBe("2026-10-31");
    expect((Date.parse(range.endIso) - Date.parse(range.startIso)) / 86400000 + 1).toBe(days);
  });
  it("keeps calendar yesterday when present and never uses today/future rows", () => {
    const fresh = csv("2026-10-03", 30);
    expect(csvReportingCalendar(completeCsvBounds(fresh.rows, now, timezone), now, timezone)).toMatchObject({ endIso: "2026-11-01", adjusted: false });
    const withFuture = [...parsed.rows, ...csv("2026-11-02", 2).rows];
    expect(completeCsvBounds(withFuture, now, timezone)?.maxIso).toBe("2026-10-31");
    expect(csvReportingCalendar(completeCsvBounds(withFuture, now, timezone), now, timezone).endIso).toBe("2026-10-31");
  });
  it("uses the client's calendar around the India/US date boundary", () => {
    const boundary=new Date("2026-11-01T20:00:00Z");
    expect(csvReportingCalendar(bounds,boundary,"Asia/Kolkata")).toMatchObject({yesterday:"2026-11-01",endIso:"2026-10-31",adjusted:true});
    expect(csvReportingCalendar(bounds,boundary,"America/Los_Angeles")).toMatchObject({yesterday:"2026-10-31",endIso:"2026-10-31",adjusted:false});
  });
  it("keeps explicit historical windows and invalid future requests from being silently rewritten", () => {
    const old = { startIso: "2026-10-10", endIso: "2026-10-16" };
    expect(alignCsvRange(old,bounds,"DAY_BREAKDOWN",now,timezone)).toEqual(old);
    const future = { startIso: "2026-11-02", endIso: "2026-11-03" };
    expect(alignCsvRange(future,bounds,"DAY_BREAKDOWN",now,timezone)).toEqual(future);
  });
  it("shares the same weekly, MTD and chart anchor", async () => {
    const context = computeWizardUploadDateContext(parsed.rows, timezone, now);
    expect(context.weeklyOptions.last7).toEqual({ startIso: "2026-10-25", endIso: "2026-10-31" });
    expect(context.weeklyOptions.prev7).toEqual({ startIso: "2026-10-18", endIso: "2026-10-24" });
    expect(context.mtdRange).toEqual({ startIso: "2026-10-01", endIso: "2026-10-31" });
    const formData = form("WEEKLY");
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData, now });
    if (!("data" in result)) throw Error(result.error);
    expect(result.data.campaignSlides[0].metrics.spend).toBe("$70");
    expect(result.data.mtdRow.spend).toBe("$300");
    expect(result.data.chart?.totalAllSpend).toBe(300);
    expect(result.data.calculationContext?.primaryRange).toEqual(context.weeklyOptions.last7);
    expect(verifyStandardWizardReportAgainstCsv({ client, platform: "META", mtdRows: parsed.rows, report: result.data, reportType: "WEEKLY", formData, now }).status).not.toBe("mismatch");
  });
  it("builds Daily from October 25–31 with all seven days and matching CSV checks", () => {
    const resolution = resolveDateSelection(parsed.rows, { mode: "custom", customStart: "2026-10-26", customEnd: "2026-11-01" }, now, timezone);
    expect(resolution.weeklyRange).toEqual({ startIso: "2026-10-25", endIso: "2026-10-31" });
    const report = buildDayBreakdownReportData({ ...base, dateRange: resolution.weeklyRange! });
    expect(report.dayCount).toBe(7); expect(report.periodLabel).toBe("Last 7 days");
    expect(reconcileDayBreakdownReportWithCsv({ report, mtdDailyRows: parsed.rows, currencySymbol: "$", selectedCampaigns: null }).status).not.toBe("mismatch");
  });
  it("uses October for a November MTD selection when no November data exists", async () => {
    const formData = form("MONTHLY", "2026-11-01", "2026-11-01");
    const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData, now });
    if (!("data" in result)) throw Error(result.error);
    expect(result.data.mtdRow.spend).toBe("$300");
    expect(result.data.cover.dateRange).toContain("October");
    expect(verifyStandardWizardReportAgainstCsv({ client, platform: "META", mtdRows: parsed.rows, report: result.data, reportType: "MONTHLY", formData, now }).status).not.toBe("mismatch");
  });
  it.each([7,15,30])("moves both %i-day comparison windows together", days => {
    const source = csv("2026-09-02", 60), sourceBounds = { minIso: "2026-09-02", maxIso: "2026-10-31" };
    const requested = comparisonPresetPeriods(days===7?"thisWeek":days===15?"last15":"last30",now,timezone);
    const periods = alignCsvComparison(requested.periodA, requested.periodB, sourceBounds,now,timezone);
    expect(periods.periodA.endIso).toBe("2026-10-31");
    expect(Date.parse(periods.periodA.startIso)-Date.parse(periods.periodB.endIso)).toBe(86400000);
    expect(validateComparisonReportCoverage(periods.periodA,periods.periodB,sourceBounds,null).valid).toBe(true);
    const report=buildComparisonReportData({ ...base, mtdDailyRows: source.rows, ...periods, now: csvReportNow(source.rows,now,timezone) });
    expect(report.campaigns[0].metricsA.spend.value).toBe(days*10);
    expect(reconcileComparisonReportWithCsv({ report, mtdDailyRows: source.rows, ...periods, currencySymbol: "$", selectedCampaigns: null }).status).not.toBe("mismatch");
  });
  it("does not invent an absent comparison period", () => {
    const requested=comparisonPresetPeriods("last30",now,timezone);
    const periods=alignCsvComparison(requested.periodA,requested.periodB,bounds,now,timezone);
    expect(validateComparisonReportCoverage(periods.periodA,periods.periodB,bounds,null).valid).toBe(false);
  });
  it("keeps multi-month windows calendar-based after shifting the reporting month", () => {
    const source=csv("2026-09-01",61);
    const formData=form("HISTORICAL","2026-10-01","2026-11-01");
    alignCsvReportFormData(formData,source.rows,timezone,now);
    const selection=JSON.parse(String(formData.get("dateSelection")));
    expect(selection).toMatchObject({customStart:"2026-09-01",customEnd:"2026-10-31"});
    const cutoffNow=csvReportNow(source.rows,now,timezone);
    expect(validateHistoricalReportInput(source.rows,2,cutoffNow,timezone,selection).valid).toBe(true);
    const report=buildHistoricalReportData({...base,mtdDailyRows:source.rows,monthCount:2,dateSelection:selection,now:cutoffNow});
    expect(report.comparisonRows.map(row=>row.spend)).toEqual(["$300","$310"]);
    expect(reconcileHistoricalReportWithCsv({ report,mtdDailyRows:source.rows,currencySymbol:"$", selectedCampaigns:null }).status).not.toBe("mismatch");
  });
  it("checks each displayed daily CPR without dropping spend on zero-result days", () => {
    const source=csv("2026-10-25",7);
    source.rows.forEach((row,index)=>{ row.results=index===1?"2":"0"; row._raw.Results=row.results; });
    const report=buildDayBreakdownReportData({...base,mtdDailyRows:source.rows,dateRange:{startIso:"2026-10-25",endIso:"2026-10-31"}});
    const check=()=>reconcileDayBreakdownReportWithCsv({report,mtdDailyRows:source.rows,currencySymbol:"$",selectedCampaigns:null});
    expect(check().status).not.toBe("mismatch");
    expect(check().checks.some(row=>row.scope.includes("Oct 26") && row.metric.includes("COST"))).toBe(true);
    report.dayRows[1].resultColumns[0].cprValue="$999.00";
    expect(check().status).toBe("mismatch");
  });
  it("does not blend different campaign objectives when they run on different days", () => {
    const source=parseCsvText(`Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Link clicks\nLeads,2026-10-25,10,2,Website leads,100,1000,40,20\nPurchases,2026-10-26,20,1,Purchases,100,1000,40,20\nClicks,2026-10-27,30,20,Link clicks,100,1000,40,20`);
    const report=buildDayBreakdownReportData({...base,mtdDailyRows:source.rows,dateRange:{startIso:"2026-10-25",endIso:"2026-10-27"}});
    expect(report.tableHeaderLabels.resultColumns.length).toBe(3);
    expect(reconcileDayBreakdownReportWithCsv({report,mtdDailyRows:source.rows,currencySymbol:"$",selectedCampaigns:null}).status).not.toBe("mismatch");
  });
  it("shows the amber cutoff note only when the CSV ends before yesterday", () => {
    const html=renderToStaticMarkup(<CsvReportingDateNote bounds={bounds} timezone={timezone} now={now}/>);
    expect(html).toContain("October 31, 2026");expect(html).toContain("November 1, 2026");expect(html).toContain("Review the reporting dates shown or continue anyway.");
    expect(renderToStaticMarkup(<CsvReportingDateNote bounds={{...bounds,maxIso:"2026-11-01"}} timezone={timezone} now={now}/>)).toBe("");
  });
});
