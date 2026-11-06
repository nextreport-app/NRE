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

describe("supplemental previous-month uploads are manual-only", () => {
 it("disables a stale previous-month flag before API preview/generation", () => {
  const form = new FormData(); form.set("includePreviousMonthComparison", "true");
  alignCsvReportFormData(form, rows, "UTC", now);
  expect(form.get("includePreviousMonthComparison")).toBe("false");
 });
 it("preserves the user's manual CSV comparison setting", () => {
  const form = new FormData(); form.set("includePreviousMonthComparison", "true");
  const manual = parseCsvText("Campaign name,Day,Amount spent (USD)\nExample,2026-11-04,10").rows;
  alignCsvReportFormData(form, manual, "UTC", now);
  expect(form.get("includePreviousMonthComparison")).toBe("true");
 });
});
