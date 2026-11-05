import {describe,expect,it} from "vitest";
import {metaApiImportRange} from "../meta-api-import-range";
import {safeMetaOAuthReturnTo} from "@/lib/meta-oauth-return";
const now=new Date("2026-11-05T12:00:00Z");
describe("API uses the same report-period rules as CSV",()=>{
 it("fetches exactly the last 30 days by default for weekly",()=>expect(metaApiImportRange({reportType:"WEEKLY"},now,"UTC")).toEqual({sinceIso:"2026-10-06",untilIso:"2026-11-04"}));
 it("extends the import for an earlier custom week without dropping the current chart",()=>expect(metaApiImportRange({reportType:"WEEKLY",dateSelection:{mode:"custom",customStart:"2026-09-01",customEnd:"2026-09-07"}},now,"UTC")).toEqual({sinceIso:"2026-09-01",untilIso:"2026-11-04"}));
 it("uses the selected month, rather than a rolling window",()=>expect(metaApiImportRange({reportType:"MONTHLY",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-31"}},now,"UTC")).toEqual({sinceIso:"2026-10-01",untilIso:"2026-10-31"}));
 it("imports all months of a historical selection",()=>expect(metaApiImportRange({reportType:"HISTORICAL",historicalMonthCount:3},now,"UTC")).toEqual({sinceIso:"2026-08-01",untilIso:"2026-10-31"}));
 it("imports both comparison windows",()=>expect(metaApiImportRange({reportType:"COMPARISON",comparisonPeriodA:{startIso:"2026-10-06",endIso:"2026-11-04"},comparisonPeriodB:{startIso:"2026-09-06",endIso:"2026-10-05"}},now,"UTC")).toEqual({sinceIso:"2026-09-06",untilIso:"2026-11-04"}));
 it("imports exactly the selected daily range",()=>expect(metaApiImportRange({reportType:"DAY_BREAKDOWN",dateSelection:{mode:"custom",customStart:"2026-10-01",customEnd:"2026-10-10"}},now,"UTC")).toEqual({sinceIso:"2026-10-01",untilIso:"2026-10-10"}));
 it("uses the account's calendar across the date line",()=>{const clock=new Date("2026-11-04T15:30:00Z");expect(metaApiImportRange({},clock,"Australia/Sydney").untilIso).toBe("2026-11-04");expect(metaApiImportRange({},clock,"America/New_York").untilIso).toBe("2026-11-03");});
 it("rejects future and invalid dates",()=>{for(const end of ["2026-11-05","2026-02-30"]){expect(()=>metaApiImportRange({reportType:"DAY_BREAKDOWN",dateSelection:{mode:"custom",customStart:"2026-02-01",customEnd:end}},now,"UTC")).toThrow();}});
 it("does not allow the OAuth return path to become an open redirect",()=>{expect(safeMetaOAuthReturnTo("/clients/example/reports/new")).toBe("/clients/example/reports/new");for(const value of ["https://other.example","//other.example","/account?next=https://other.example"]){expect(safeMetaOAuthReturnTo(value)).toBeNull();}});
});

describe("report selection alone determines the API window", () => {
 it("uses calendar months, not a rolling 90-day source window", () => {
  expect(metaApiImportRange({ reportType: "HISTORICAL", historicalMonthCount: 3, dateSelection: { mode: "custom", customStart: "2026-08-01", customEnd: "2026-10-31" } }, now, "UTC")).toEqual({ sinceIso: "2026-08-01", untilIso: "2026-10-31" });
 });
 it("keeps weekly report presets inside the automatic 30-day fetch", () => {
  for (const mode of ["last7", "prev7", "last14"] as const) expect(metaApiImportRange({ reportType: "WEEKLY", dateSelection: { mode } }, now, "UTC")).toEqual({ sinceIso: "2026-10-06", untilIso: "2026-11-04" });
 });
 it("rejects invalid custom report periods", () => {
  for (const [customStart, customEnd] of [["", ""], ["2026-10-01", "2026-11-05"], ["2026-10-02", "2026-10-01"]]) expect(() => metaApiImportRange({ reportType: "WEEKLY", dateSelection: { mode: "custom", customStart, customEnd } }, now, "UTC")).toThrow();
 });
});
