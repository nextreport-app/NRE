import {describe,expect,it} from "vitest";
import {parseCsvText} from "../parse-csv";
import {validateMtdDailyCsv} from "../validate";
import {buildReportData} from "../report-data";
const now = new Date("2026-11-18T12:00:00Z");
const base = "Campaign name,Ad set name,Day,Amount spent (USD),Results,Result type,Impressions,Reach";
const row = "Example,Set,2026-11-17,10,1,Leads (form),100,90";
describe("Meta audience import boundary",()=>{
 it.each([["Age","25-34"],["Region","Tennessee"],["Placement,Platform","Feed,facebook"]])("recognizes %s as a separate reporting grain",(dimension,value)=>{
  const parsed=parseCsvText(`${base},${dimension}\n${row},${value}\n${row},${value}`);
  const result=validateMtdDailyCsv(parsed.colMap,parsed.rows,now,parsed.headers,"META");
  expect(result.valid).toBe(false);
  expect(result.errors.some(error=>error.field==="audience_breakdown")).toBe(true);
  expect(result.errors.some(error=>error.field==="duplicate_rows")).toBe(false);
 });
 it("also rejects one segment row, which would otherwise silently lose its segment",()=>{
  const parsed=parseCsvText(`${base},Age\n${row},25-34`);
  expect(validateMtdDailyCsv(parsed.colMap,parsed.rows,now,parsed.headers,"META").errors.some(error=>error.field==="audience_breakdown")).toBe(true);
 });
 it("accepts ordinary daily imports and does not append hidden creative prototype slides",()=>{
  const parsed=parseCsvText(`${base},Ad name\n${row},Example image`);
  expect(validateMtdDailyCsv(parsed.colMap,parsed.rows,now,parsed.headers,"META").valid).toBe(true);
  const report=buildReportData({accountName:"Example",currencySymbol:"$",timezone:"UTC",monthlyBudget:null,mtdDailyRows:parsed.rows,now,adNameColumn:"Ad name"});
  expect(report.campaignSlides).toHaveLength(1);expect(report.creative).toBeNull();
 });
});
