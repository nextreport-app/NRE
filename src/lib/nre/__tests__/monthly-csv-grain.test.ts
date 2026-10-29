import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import type { Client } from "@/generated/prisma/client";
import { parseCsvText } from "../parse-csv";
import { validateMtdDailyCsv } from "../validate";
import { computeCsvDateBounds } from "../date-range";
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import { buildHistoricalReportData } from "../historical-report-data";
import { verifyStandardWizardReportAgainstCsv } from "../wizard-csv-verification";
import { monthlySelectionFromBounds, selectedSinglePeriod, restoredMonthCount } from "../report-period-selection";
const now = new Date("2026-10-29T12:00:00Z");
const client = { id:"test",userId:"test",accountName:"Example",currency:"USD",timezone:"UTC",monthlyBudget:null,campaignObjectiveCache:null,showBudgetPacingOnCover:false } as Client;
function input(start="2026-09-01",end="2026-09-30",extra="") {
  return parseCsvText(`Campaign name,Reporting starts,Reporting ends,Amount spent (USD),Results,Result type,Reach,Impressions,Clicks (all),Link clicks,Starts,Campaign delivery${extra ? ",Month" : ""}\nExample,${start},${end},300,6,Website leads,1000,9000,90,60,2026-09-12,active${extra ? ","+extra : ""}`);
}
function validate(parsed:ReturnType<typeof input>,type="MONTHLY") { return validateMtdDailyCsv(parsed.colMap,parsed.rows,now,parsed.headers,"META",undefined,type); }
async function monthly(parsed:ReturnType<typeof input>,start="2026-09-01",end="2026-09-30") {
  const formData=new FormData();formData.set("reportType",JSON.stringify("MONTHLY"));formData.set("dateSelection",JSON.stringify({mode:"custom",customStart:start,customEnd:end}));
  return { result:await buildStandardReportForWizard({client,platform:"META",mtdParsed:parsed,formData,now}),formData };
}
describe("monthly CSV interval facts",()=>{
 it("restores monthly counts including legacy six-month custom drafts",()=>{
  expect(restoredMonthCount(6,"HISTORICAL")).toBe(6);
  expect(restoredMonthCount(undefined,"HISTORICAL","2026-04-01","2026-09-30")).toBe(6);
  expect(restoredMonthCount(undefined,"MONTHLY")).toBe(1);
  expect(restoredMonthCount(99,"HISTORICAL")).toBe(3);
 });
 it("accepts campaign totals without Day rows and preserves exact period metrics and labels",async()=>{
  const parsed=input();expect(validate(parsed).valid).toBe(true);
  expect(parsed.rows).toHaveLength(1); // The campaign began mid-month; its monthly total is still valid.
  expect(parsed.rows[0]._raw.Day).toBeUndefined();
  expect(computeCsvDateBounds(parsed.rows)).toEqual({minIso:"2026-09-01",maxIso:"2026-09-30"});
  const {result,formData}=await monthly(parsed);if(!("data" in result))throw Error(result.error);
  expect(result.data.campaignSlides[0].metrics).toMatchObject({spend:"$300",reach:"1,000",results:"6",ctr:"1.00%",cpc:"$3.33",cpr:"$50.00"});
  expect(result.data.cover.dateRange).toContain("September 30");
  expect(result.data.chart?.actualPeriodDays).toBe(30);expect(result.data.chart?.totalAllSpend).toBe(300);
  expect(result.data.mtdRow.spend).toBe("$300");expect(result.data.periodRow.hasData).toBe(false);
  const check=verifyStandardWizardReportAgainstCsv({client,platform:"META",mtdRows:parsed.rows,report:result.data,reportType:"MONTHLY",formData,now});
  expect(check.checks.filter(row=>row.status==="mismatch")).toEqual([]);
 });
 it("requires daily rows for Weekly, Comparison and daily tables",()=>{
  for(const type of ["WEEKLY","COMPARISON","DAY_BREAKDOWN"]){const parsed=input();expect(validate(parsed,type).valid).toBe(false);}
 });
 it("accepts monthly breakdown rows with file-wide Reporting dates and renders separate months",()=>{
  const parsed=parseCsvText("Campaign name,Reporting starts,Reporting ends,Month,Amount spent (USD),Results,Result type,Reach,Impressions\n"+[7,8,9].map((month,i)=>`Example,2026-07-01,2026-09-30,2026-${String(month).padStart(2,"0")}-01,${100*(i+1)},${i+1},Website leads,100,1000`).join("\n"));
  expect(validate(parsed,"HISTORICAL").valid).toBe(true);
  const result=buildHistoricalReportData({accountName:"Example",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:parsed.rows,monthCount:3,now});
  expect(result.comparisonRows.map(row=>row.spend)).toEqual(["$100","$200","$300"]);
  expect(result.slides.filter(slide=>slide.isMonthTotal)).toHaveLength(3);
  expect(parsed.rows.every(row=>!row._raw.Day)).toBe(true);
 });
 it("supports observed current MTD ending before yesterday without labelling extra days",async()=>{
  const parsed=input("2026-10-01","2026-10-27");expect(validate(parsed).valid).toBe(true);
  const {result}=await monthly(parsed,"2026-10-01","2026-10-27");if(!("data"in result))throw Error(result.error);
  expect(result.data.cover.dateRange).toContain("October 27");expect(result.data.chart?.actualPeriodDays).toBe(27);
 });
 it("does not slice totals that include today",async()=>{
  const parsed=input("2026-10-01","2026-10-29");expect(validate(parsed).valid).toBe(true);
  const {result}=await monthly(parsed,"2026-10-01","2026-10-28");expect(result).toEqual({error:expect.stringContaining("cannot be sliced")});
 });
 it("rejects partial closed months, missing source dates, combined multi-month totals and duplicate scopes",async()=>{
  const partial=input("2026-09-01","2026-09-15");const {result}=await monthly(partial);expect(result).toHaveProperty("error");
  expect(validate(input("2026-09-01","")).valid).toBe(false);
  expect(validate(input("2026-07-01","2026-09-30")).valid).toBe(false);
  const duplicate=input();duplicate.rows.push({...duplicate.rows[0],ad_set_name:"Another set"});expect(validate(duplicate).errors).toContainEqual(expect.objectContaining({field:"monthly_grain"}));
 });
 it("rejects mixed daily/month-total rows in every report mode",()=>{
  for(const type of ["MONTHLY","WEEKLY"]){const parsed=input();parsed.rows.push({...parsed.rows[0],_raw:{...parsed.rows[0]._raw,Day:"2026-09-12"}});expect(validate(parsed,type).valid).toBe(false);}
 });
 it.each([
  [{minIso:"2026-09-01",maxIso:"2026-09-30"},1,"2026-09-01","2026-09-30"],
  [{minIso:"2026-07-01",maxIso:"2026-09-30"},3,"2026-07-01","2026-09-30"],
  [{minIso:"2026-09-29",maxIso:"2026-10-28"},1,"2026-10-01","2026-10-28"],
  [{minIso:"2026-10-01",maxIso:"2026-10-27"},1,"2026-10-01","2026-10-27"],
 ])("defaults Monthly from the source bounds %j",(bounds,count,startIso,endIso)=>{
  expect(monthlySelectionFromBounds(bounds,now,"UTC")).toEqual({count,startIso,endIso});
 });
 it("does not treat a partial previous month as MTD on the first of a new month",()=>{
  expect(()=>selectedSinglePeriod("MONTHLY",{mode:"custom",customStart:"2026-09-01",customEnd:"2026-09-15"},new Date("2026-10-01T12:00:00Z"),"UTC")).toThrow();
 });
});
