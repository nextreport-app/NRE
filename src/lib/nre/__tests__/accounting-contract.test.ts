import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { aggregateDynamicMetrics } from "../dynamic-metrics";
import { buildColumnMap } from "../columns";
import { sourceNumericIssues, duplicateDailyFacts } from "../source-contract";
import { computeWizardStandardReportFingerprint } from "../wizard-report-config-fingerprint";

const now = new Date("2026-10-03T12:00:00Z");
const weeklyRange = { startIso: "2026-10-01", endIso: "2026-10-02" };
function report(csv: string, extra = {}) {
  const rows = parseCsvText(csv).rows;
  const data = buildReportData({ accountName: "Audit", currencySymbol: "$", timezone: "UTC", monthlyBudget: null, mtdDailyRows: rows, now, weeklyRange, ...extra });
  return { rows, data, verify: () => reconcileStandardReportWithCsv({ report: data, mtdDailyRows: rows, reportType: data.reportType, timezone: "UTC", currencySymbol: "$", now }) };
}

describe("source-backed reporting accounting", () => {
  it("uses the same objective evidence for DD-MM-YYYY and ISO daily exports", () => {
    const csv = "Campaign name,Ad set name,Day,Result type,Results,Amount spent\nCampaign A,Set A,01-10-2026,Website purchases,2,100";
    const { data } = report(csv);
    expect(data.campaignSlides[0].resultLabel).toBe("PURCHASES");
    expect(data.mtdRow.resultColumns[0]).toMatchObject({ label: "PURCHASES", value: "2", cprValue: "$50.00" });
  });
  it.each([
    ["Link clicks", "Link clicks"], ["Landing page views", "Landing page views"],
    ["Leads (form)", "Meta leads"], ["ThruPlay", "3-second video plays"],
    ["Messaging conversations started", "Messaging conversations started"],
  ])("keeps %s primary chips on the same Results basis as the table", (type, trackingColumn) => {
    const { data } = report(`Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions,${trackingColumn}\nCampaign A,Set A,2026-10-01,${type},2,100,100,200,50`);
    const slide = data.campaignSlides[0];
    expect(slide.metrics).toMatchObject({ results: "2", cpr: "$50.00" });
    expect(slide.dynamicMetrics[3]?.value).toBe("2");
    expect(slide.dynamicMetrics[4]?.value).toBe("$50.00");
    expect(data.mtdRow.resultColumns[0]).toMatchObject({ value: "2", cprValue: "$50.00" });
  });
  it("does not erase purchases when a secondary Website Leads column is present", () => {
    const { data, verify } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Website leads,Purchases,Reach,Impressions\nCampaign A,Set A,2026-10-01,Website purchases,2,100,1,2,100,200");
    expect(data.mtdRow.resultColumns).toEqual([expect.objectContaining({ label: "PURCHASES", value: "2", cprValue: "$50.00" })]);
    expect(data.mtdRow.accounting?.PURCHASES).toMatchObject({ spendBasis: 100, resultCount: 2, rate: 50 });
    expect(data.campaignSlides[0].metrics).toMatchObject({ results: "2", cpr: "$50.00" });
    expect(verify().status).toBe("ok");
  });

  it("flags an omitted primary event in a mixed-goal campaign instead of green verification", () => {
    const { verify } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Website leads,Purchases,Reach,Impressions\nCampaign A,Set A,2026-10-01,Website purchases,2,100,0,2,100,200\nCampaign A,Set A,2026-10-02,website submission,3,60,3,0,100,200");
    expect(verify().checks).toContainEqual(expect.objectContaining({ metric: "Source objective coverage", status: "mismatch" }));
  });

  it("uses the same known period Reach in the MTD count and campaign rate", () => {
    const { data } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions,Frequency\nReach campaign,Set A,2026-10-01,Reach,100,50,100,100,1\nReach campaign,Set A,2026-10-02,Reach,100,50,100,100,1", { metaCampaignPeriodReach: { byRangeKey: { "2026-10-01:2026-10-02": { "reach campaign": 100 } } } });
    expect(data.mtdRow.resultColumns[0]).toMatchObject({ label: "REACH", value: "100", cprValue: "$1000.00" });
    expect(data.campaignSlides[0].metrics).toMatchObject({ results: "100", cpr: "$1000.00" });
  });

  it("scales impressions cost per thousand", () => {
    const { data, verify } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions\nCampaign A,Set A,2026-10-01,Impressions,10000,100,100,10000");
    expect(data.mtdRow.resultColumns[0]).toMatchObject({ label: "IMPRESSIONS", value: "10,000", cprValue: "$10.00" });
    expect(verify().checks).toContainEqual(expect.objectContaining({ metric: "CPM formula", status: "ok" }));
  });

  it("uses the resolved DAILY scope rather than recomputing a month for verification", () => {
    const { data, rows } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions\nWebsite Leads,Set A,2026-10-01,website submission,2,100,100,200\nWebsite Leads,Set A,2026-10-02,website submission,3,60,100,200", { reportType: "DAILY", weeklyRange: { startIso: "2026-10-02", endIso: "2026-10-02" } });
    const verification = reconcileStandardReportWithCsv({ report: data, mtdDailyRows: rows, reportType: "DAILY", timezone: "UTC", currencySymbol: "$", now: new Date("2026-11-01T12:00:00Z") });
    expect(data.mtdRow.resultColumns[0].value).toBe("3");
    expect(verification.checks.filter(check => check.scope.startsWith("Month-to-date")).every(check => check.status === "ok")).toBe(true);
  });

  it("rejects a missing printed rate even if the underlying counts match", () => {
    const { data, verify } = report("Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD)\nWebsite Leads,Set A,2026-10-01,website submission,2,100");
    data.mtdRow.resultColumns[0].cprValue = "—";
    expect(verify().checks.some(check => check.metric === "COST PER WEBSITE LEAD" && check.status === "mismatch")).toBe(true);
  });
});

describe("CSV and metric dimensions", () => {
  it("never binds a cost column or Results(initial) as an event quantity", () => {
    const map = buildColumnMap(["Cost per website lead", "Cost per purchase", "Results (initial)", "Results", "Website leads", "Purchases"]);
    expect(map).toMatchObject({ results: "Results", website_leads: "Website leads", purchases: "Purchases" });
  });
  it("reports malformed values and duplicate source days", () => {
    const parsed = parseCsvText('Campaign name,Ad set name,Day,Results,Amount spent\nA,S,2026-10-01,2,"12,34"\nA,S,2026-10-01,2,20');
    expect(sourceNumericIssues(parsed.rows, parsed.colMap)).toHaveLength(1);
    expect(duplicateDailyFacts(parsed.rows)).toHaveLength(1);
  });
  it("does not confuse INR all-click CPC with link-click CPC", () => {
    const values = aggregateDynamicMetrics([{ _raw: { "Amount spent (INR)": "1000", Impressions: "1000", "CTR (all)": "10", "CPC (all)": "10", "Link clicks": "10" } }], [{ key: "cpc_all", format: "currency", csvName: "cpc (all)" }], "meta");
    expect(values.cpc_all).toBe(10);
  });
  it("weights CTR by impressions instead of averaging daily percentages", () => {
    const values = aggregateDynamicMetrics([{ _raw: { "CTR (all)": "10", Impressions: "1000" } }, { _raw: { "CTR (all)": "1", Impressions: "9000" } }], [{ key: "ctr", format: "percentage", csvName: "ctr (all)" }], "meta");
    expect(values.ctr).toBeCloseTo(1.9);
  });
});

describe("versioned preview cache identity", () => {
  const client = { id: "client", timezone: "UTC", monthlyBudget: null, showBudgetPacingOnCover: false, campaignObjectiveCache: null, currency: "USD" as const, previousMonthDataUrl: "old.csv" };
  const fingerprint = (changes = {}, date = now) => computeWizardStandardReportFingerprint({ fileHash: "file", client: { ...client, ...changes }, platform: "META", formData: null, now: date });
  it("invalidates when currency, prior upload, or reporting day changes", () => {
    expect(fingerprint({ currency: "INR" })).not.toBe(fingerprint());
    expect(fingerprint({ previousMonthDataUrl: "new.csv" })).not.toBe(fingerprint());
    expect(fingerprint({}, new Date("2026-10-04T12:00:00Z"))).not.toBe(fingerprint());
    expect(fingerprint({}, new Date("2026-10-03T13:00:00Z"))).toBe(fingerprint());
  });
});
