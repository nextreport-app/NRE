import {describe,expect,it} from "vitest";
import {parseCsvText} from "../parse-csv";
import {csvReportNow,alignCsvReportFormData} from "../csv-reporting-calendar";
import {computeCsvDateBounds} from "../date-range";
import {metaApiSelectionCoverageError} from "../meta-api-selection-coverage";
const rows=parseCsvText("Campaign name,Day,Amount spent (USD),NRE API range start,NRE API range end\nExample,2026-10-26,10,2026-10-06,2026-11-04").rows;
const now=new Date("2026-11-05T12:00:00Z");
describe("API query coverage without fabricated daily observations",()=>{
 it("does not slide the reporting clock to the last spending day",()=>{expect(computeCsvDateBounds(rows)).toEqual({minIso:"2026-10-06",maxIso:"2026-11-04"});expect(csvReportNow(rows,now,"UTC")).toEqual(now);expect(rows).toHaveLength(1);});
 it("asks for re-sync when new selected dates are outside the imported window",()=>{const form=new FormData();form.set("reportType",JSON.stringify("MONTHLY"));form.set("dateSelection",JSON.stringify({mode:"custom",customStart:"2026-09-01",customEnd:"2026-09-30"}));expect(metaApiSelectionCoverageError(form,rows,"UTC",now)).toContain("sync the ad account again");});
});

describe("previous-month API coverage", () => {
 it("retains the toggle and requires a full-month API import", () => {
  const form = new FormData(); form.set("includePreviousMonthComparison", "true");
  alignCsvReportFormData(form, rows, "UTC", now);
  expect(form.get("includePreviousMonthComparison")).toBe("true");
  expect(metaApiSelectionCoverageError(form, rows, "UTC", now)).toContain("sync the ad account again");
 });
 it("preserves the user's manual CSV comparison setting", () => {
  const form = new FormData(); form.set("includePreviousMonthComparison", "true");
  const manual = parseCsvText("Campaign name,Day,Amount spent (USD)\nExample,2026-11-04,10").rows;
  alignCsvReportFormData(form, manual, "UTC", now);
  expect(form.get("includePreviousMonthComparison")).toBe("true");
 });
});

describe("paused campaign custom weekly coverage", () => {
 const paused = parseCsvText("Campaign name,Day,Amount spent (USD),NRE API range start,NRE API range end\nPaused,2026-11-18,10,2026-10-01,2026-11-26").rows;
 function weekly(start: string, end: string) {
  const form = new FormData(); form.set("reportType", JSON.stringify("WEEKLY"));
  form.set("dateSelection", JSON.stringify({mode:"custom",customStart:start,customEnd:end})); return form;
 }
 it("accepts an explicitly covered week after the reporting clock advances, without fabricating activity", () => {
  expect(metaApiSelectionCoverageError(weekly("2026-11-20","2026-11-26"),paused,"UTC",new Date("2026-11-28T12:00:00Z"))).toBeNull();
  expect(paused).toHaveLength(1);
 });
 it("still rejects explicit dates outside the actual query window", () => {
  expect(metaApiSelectionCoverageError(weekly("2026-11-21","2026-11-27"),paused,"UTC",new Date("2026-11-28T12:00:00Z"))).toContain("sync the ad account again");
 });
 it("requires a fresh import for a rolling last-seven-days preset", () => {
  const form = new FormData(); form.set("reportType",JSON.stringify("WEEKLY")); form.set("dateSelection",JSON.stringify({mode:"last7"}));
  expect(metaApiSelectionCoverageError(form,paused,"UTC",new Date("2026-11-28T12:00:00Z"))).toContain("sync the ad account again");
 });
});
