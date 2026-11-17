import { describe, expect, it, vi } from "vitest";
import { previousMonthRows, previousMonthSourceInfo } from "../previous-month-source";
import { parseCsvText } from "../parse-csv";
vi.mock("@/lib/storage", () => ({ readPreviousMonthDataFile: vi.fn() }));
import { readPreviousMonthDataFile } from "@/lib/storage";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import type { Client } from "@/generated/prisma/client";
import { resolveWeeklyPreviousMonthRows } from "../previous-month-data";
const now = new Date("2026-11-17T18:00:00Z");
const raw = "Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nForms,Forms,2026-08-01,3000,1,Leads (form),10,20\nForms,Forms,2026-10-01,1000,100,Leads (form),10,20\nForms,Forms,2026-10-31,534.88,86,Leads (form),10,20\nTraffic,Traffic,2026-10-01,500,2000,Link clicks,10,20\nTraffic,Traffic,2026-10-31,46.38,55,Link clicks,10,20\nForms,Forms,2026-11-16,2000,10,Leads (form),10,20";
const rows = () => parseCsvText(raw).rows;
const client = { timezone: "America/Chicago", previousMonthDataUrl: "stored.csv", previousMonthSelectedCampaigns: null };
describe("previous-month source selection", () => {
 it("scopes a broad import to October before computing badges", () => {
   const info = previousMonthSourceInfo(rows(), "import", client.timezone, now);
   expect(info.ready).toBe(true); expect(info.campaignSpend).toEqual({ Forms: 1534.88, Traffic: 546.38 });
   expect(info.range).toEqual({ startIso: "2026-10-01", endIso: "2026-10-31" });
 });
 it("reuses the import without reading or adding a stored file", async () => {
   vi.mocked(readPreviousMonthDataFile).mockClear();
   const scoped = await resolveWeeklyPreviousMonthRows(rows(), client, null, now);
   expect(scoped).toHaveLength(4);expect(readPreviousMonthDataFile).not.toHaveBeenCalled();
 });
 it("filters a broad stored fallback by the same month and campaign choice", async () => {
   vi.mocked(readPreviousMonthDataFile).mockResolvedValue(Buffer.from(raw));
   const scoped = await resolveWeeklyPreviousMonthRows(rows().filter(r=>r.date_start==='2026-11-16'), client, ['Traffic'], now);
   expect(scoped?.map(r=>r.spend)).toEqual(['500','46.38']);
 });
 it("does not treat a recent upload of the wrong month as ready", async () => {
   vi.mocked(readPreviousMonthDataFile).mockResolvedValue(Buffer.from(raw.replaceAll('2026-10','2026-09')));
   expect(await resolveWeeklyPreviousMonthRows([],client,null,now)).toBeUndefined();
 });
 it("rejects incomplete coverage and unsliceable multi-month totals", () => {
   expect(previousMonthRows(rows().filter(r=>r.date_start==='2026-10-01'),client.timezone,now)).toBeUndefined();
   const totals=parseCsvText('Campaign name,Amount spent (USD),Reporting starts,Reporting ends\nForms,8000,2026-08-01,2026-11-16').rows;
   expect(previousMonthRows(totals,client.timezone,now)).toBeUndefined();
 });
 it("accepts an exact monthly total and handles the January year boundary", () => {
   const totals=parseCsvText('Campaign name,Amount spent (USD),Reporting starts,Reporting ends\nForms,1534.88,2026-10-01,2026-10-31').rows;
   expect(previousMonthRows(totals,client.timezone,now)).toHaveLength(1);
   const december=parseCsvText(raw.replaceAll('2026-10','2025-12').replaceAll('2026-08-01','2025-11-01').replaceAll('2026-11-16','2026-01-16')).rows;
   expect(previousMonthSourceInfo(december,'import',client.timezone,new Date('2026-01-17T18:00:00Z')).range).toEqual({startIso:'2025-12-01',endIso:'2025-12-31'});
 });
 it("uses October-only totals in the weekly engine and its independent verification", async () => {
   const parsed = parseCsvText(raw);
   const form = new FormData();
   form.set("reportType", JSON.stringify("WEEKLY"));
   form.set("dateSelection", JSON.stringify({ mode: "custom", customStart: "2026-11-10", customEnd: "2026-11-16" }));
   form.set("includePreviousMonthComparison", "true");
   form.set("previousMonthSelectedCampaigns", JSON.stringify(["Forms", "Traffic"]));
   const account = { ...client, previousMonthDataUrl: null, id: "test", userId: "test", accountName: "Test", currency: "USD", monthlyBudget: null, campaignObjectiveCache: null, showBudgetPacingOnCover: false } as Client;
   const built = await buildStandardReportForWizard({ client: account, platform: "META", mtdParsed: parsed, formData: form, now });
   if (!("data" in built)) throw Error(built.error);
   expect(built.data.periodRow.spend).toBe("$2,081.26");
   const scoped = await resolveWeeklyPreviousMonthRows(parsed.rows, account, ["Forms", "Traffic"], now);
   expect(verifyStandardWizardReportAgainstCsv({ client: account, platform: "META", mtdRows: parsed.rows, report: built.data, reportType: "WEEKLY", formData: form, periodRows: scoped, now }).status).not.toBe("mismatch");
 });
});
