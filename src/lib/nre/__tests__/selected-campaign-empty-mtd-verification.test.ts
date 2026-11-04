import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import { parseCsvText } from "../parse-csv";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";

const name = "Selected Instant Form Campaign";
const now = new Date("2026-11-04T12:00:00Z");
function csv(extra = "") {
  return parseCsvText(`Campaign name,Ad set name,Day,Result type,Results,Amount spent (USD),Reach,Impressions,Link clicks
${name},Original,2026-10-03,Leads (form),90,999,100,200,5
${name},Original,2026-10-05,Leads (form),1,11.12,100,200,5
${name},Original,2026-10-24,Leads (form),2,22.23,200,400,10
${name},Original,2026-10-26,Leads (form),3,33.34,300,600,15
Other campaign,Replacement,2026-11-02,,0,9.79,100,200,5
Other campaign,Replacement,2026-11-03,,0,11.11,100,200,5
${extra}`);
}
async function setup(timezone = "UTC", extra = "") {
  const parsed = csv(extra);
  const client = { id: "sample", userId: "sample", accountName: "Sample", currency: "USD", timezone, monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
  const formData = new FormData();
  formData.set("reportType", JSON.stringify("WEEKLY"));
  formData.set("selectedCampaigns", JSON.stringify([name]));
  formData.set("dateSelection", JSON.stringify({ mode: "custom", customStart: "2026-10-28", customEnd: "2026-11-03" }));
  const result = await buildStandardReportForWizard({ client, platform: "META", mtdParsed: parsed, formData, now });
  if (!("data" in result)) throw new Error(result.error);
  const verify = () => verifyStandardWizardReportAgainstCsv({ client, platform: "META", mtdRows: parsed.rows, report: result.data, reportType: "WEEKLY", formData, now });
  return { report: result.data, verify };
}
describe("single selected campaign with no new-month activity", () => {
  it.each(["UTC", "America/New_York", "Australia/Sydney", "Asia/Kolkata"])("keeps confirmed dates and verifies available chart data in %s", async timezone => {
    const { report, verify } = await setup(timezone);
    expect(report.calculationContext?.primaryRange).toEqual({ startIso: "2026-10-28", endIso: "2026-11-03" });
    expect(report.cover.dateRange).toContain("October 28");
    expect(report.isPaused).toBe(true);
    expect(report.campaignSlides).toEqual([]);
    expect(report.mtdRow.hasData).toBe(false);
    expect(report.chart?.totalAllSpend).toBeCloseTo(66.69);
    expect(report.chart?.campaigns.map(campaign => campaign.name)).toEqual([name]);
    const verification = verify();
    expect(verification.status).toBe("ok");
    expect(verification.checks.length).toBeGreaterThan(0);
    expect(verification.scopesVerified?.every(scope => scope.startsWith("Last 30 days"))).toBe(true);
    expect(verification.coverageWarnings).toContainEqual(expect.objectContaining({ missingDays: ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03"] }));
  });
  it("verifies the October portion of a cross-month week even when November MTD is empty", async () => {
    const { report, verify } = await setup("UTC", `${name},Original,2026-10-29,Leads (form),2,10,100,200,5`);
    expect(report.isPaused).toBe(false);
    expect(report.campaignSlides).toHaveLength(1);
    expect(report.campaignSlides[0].metrics.spend).toBe("$10");
    expect(report.calculationContext?.primaryRange?.endIso).toBe("2026-11-03");
    expect(report.mtdRow.hasData).toBe(false);
    const verification = verify();
    expect(verification.status).toBe("ok");
    expect(verification.checks.some(check => check.scope.startsWith("Report week"))).toBe(true);
  });
  it("prefers the selected campaign chart objective to a different previous-month objective", async () => {
    const { report, verify } = await setup();
    report.periodRow.resultColumns = [{ label: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", value: "999", cprValue: "$1" }];
    expect(verify().primaryResultLabel).toBe("META FORM LEADS");
    expect(verify().status).toBe("ok");
  });
  it("still detects a corrupted chart total with empty MTD", async () => {
    const { report, verify } = await setup();
    report.chart!.totalAllSpend += 100;
    expect(verify().status).toBe("mismatch");
  });
});
