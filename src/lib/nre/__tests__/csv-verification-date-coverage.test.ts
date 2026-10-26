import { describe, expect, it } from "vitest";
import { parseCsvText } from "../parse-csv";
import { buildReportData } from "../report-data";
import { reconcileStandardReportWithCsv } from "../csv-report-reconciliation";
import { adSetKey } from "../ad-sets";

// Anonymous reproduction: paused campaign ends Oct 20, replacement starts Oct 22.
// Meta can omit a no-delivery date; that is not evidence of a numeric mismatch.
const csv = [
  "Campaign name,Ad set name,Day,Delivery status,Result type,Results,Amount spent (USD),Reach,Impressions,Clicks (all),CTR (all),Link clicks,Starts",
  "Existing Website Leads,Original,2026-09-26,inactive,Website leads,0,5,80,100,10,10,8,2026-07-01",
  ...[19, 20].map(day => `Existing Website Leads,Original,2026-10-${day},inactive,Website leads,0,10,80,100,10,10,8,2026-07-01`),
  ...[22, 23, 24, 25].map(day => `New Website Leads,Broad,2026-10-${day},active,Website leads,0,20,80,100,10,10,8,2026-10-22`),
].join("\n");

function setup(extraRow?: string) {
  const rows = parseCsvText(csv + (extraRow ? `\n${extraRow}` : "")).rows;
  const input = {
    accountName: "Coverage regression", currencySymbol: "$", timezone: "UTC", monthlyBudget: null,
    mtdDailyRows: rows, selectedAdSets: [adSetKey("Existing Website Leads", "Original")],
    weeklyRange: { startIso: "2026-10-19", endIso: "2026-10-25" },
    reportType: "WEEKLY" as const, now: new Date("2026-10-26T12:00:00Z"),
  };
  const report = buildReportData(input);
  return { input, report, verify: () => reconcileStandardReportWithCsv({ ...input, report }) };
}

describe("numeric reconciliation independent of source date coverage", () => {
  it("matches the supplied rows and reports one date concern instead of 14 false mismatches", () => {
    const { report, verify } = setup();
    expect(report.campaignSlides).toHaveLength(2);
    expect(report.adSetSlides).toHaveLength(1);
    const result = verify();
    expect(result.status).toBe("ok");
    expect(result.checks.filter(check => check.status === "mismatch")).toEqual([]);
    expect(result.checks.filter(check => check.scope.startsWith("Report week"))).toHaveLength(13);
    expect(result.coverageWarnings).toEqual([expect.objectContaining({ missingDays: ["2026-10-21"] })]);
    expect(result.canAlignWithCsvExport).toBe(false);
  });

  it("still catches wrong campaign spend when the same date gap exists", () => {
    const { report, verify } = setup();
    report.campaignSlides[0].metrics.spend = "$40";
    const result = verify();
    expect(result.status).toBe("mismatch");
    expect(result.checks).toContainEqual(expect.objectContaining({ metric: "Amount spent", status: "mismatch", scope: expect.stringContaining("Report week") }));
    expect(result.coverageWarnings?.[0].missingDays).toEqual(["2026-10-21"]);
  });

  it("still catches wrong campaign CTR and ad-set spend independently", () => {
    const { report, verify } = setup();
    report.campaignSlides[0].metrics.ctr = "99.00%";
    report.adSetSlides[0].metrics.spend = "$40";
    const result = verify();
    expect(result.status).toBe("mismatch");
    expect(result.checks).toContainEqual(expect.objectContaining({ metric: expect.stringContaining("CTR (all)"), status: "mismatch" }));
    expect(result.checks).toContainEqual(expect.objectContaining({ metric: "Amount spent", status: "mismatch", scope: expect.stringContaining("Ad set") }));
  });

  it("still catches wrong primary Results rather than suppressing warnings", () => {
    const { report, verify } = setup();
    report.campaignSlides[0].metrics.results = "1";
    const result = verify();
    expect(result.status).toBe("mismatch");
    expect(result.checks).toContainEqual(expect.objectContaining({ metric: "WEBSITE LEADS", status: "mismatch" }));
  });

  it("needs no coverage notice when the source explicitly includes a zero-delivery day", () => {
    const { verify } = setup("Existing Website Leads,Original,2026-10-21,inactive,Website leads,0,0,0,0,0,0,0,2026-07-01");
    const result = verify();
    expect(result.status).toBe("ok");
    expect(result.coverageWarnings ?? []).toEqual([]);
  });
});
