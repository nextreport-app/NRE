import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "../parse-file";
import { computeCsvDateBounds } from "../date-range";
import { validateMtdDailyCsv } from "../validate";
import { computeWizardUploadDateContext } from "../wizard-upload-date-context";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
import { buildStandardReportForWizard } from "../report-engine/build-standard-from-wizard";
import type { Client } from "@/generated/prisma/client";

const now = new Date("2026-11-08T12:00:00Z");
function workbook(format: string, date1904 = false) {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Campaign name", "Ad set name", "Day", "Amount spent (USD)", "Results", "Result type", "Reach", "Impressions", "Duration"],
    ["Example", "Main", 46266 - (date1904 ? 1462 : 0), 10.25, 1, "Leads (form)", 100, 1000, 0.05],
    ["Example", "Main", 46332 - (date1904 ? 1462 : 0), 20.75, 2, "Leads (form)", 100, 1000, 0.05],
  ]);
  sheet.C2.z = sheet.C3.z = format;
  sheet.D2.z = sheet.D3.z = '$0.00';
  sheet.I2.z = sheet.I3.z = 'hh:mm';
  const book = XLSX.utils.book_new();
  book.Workbook = { WBProps: { date1904 } };
  XLSX.utils.book_append_sheet(book, sheet, "Meta export");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
function expectLatestDay(buffer: Buffer, rowCount?: number) {
  const parsed = parseUploadedFile(buffer);
  if (rowCount) expect(parsed.rows).toHaveLength(rowCount);
  expect(computeCsvDateBounds(parsed.rows)).toMatchObject({ minIso: "2026-09-01", maxIso: "2026-11-06" });
  const validation = validateMtdDailyCsv(parsed.colMap, parsed.rows, now, parsed.headers, "META");
  expect(validation.errors).toEqual([]);
  expect(validation.valid).toBe(true);
  const context = computeWizardUploadDateContext(parsed.rows, "America/New_York", now);
  expect(context.weeklyOptions.last7).toEqual({ startIso: "2026-10-31", endIso: "2026-11-06" });
  expect(context.mtdRange).toEqual({ startIso: "2026-11-01", endIso: "2026-11-06" });
}
describe("native workbook calendar dates", () => {
  it.each(["m/d/yy", "mm/dd/yyyy", "dd/mm/yyyy", "dd-mmm-yyyy"])("uses date serials rather than ambiguous %s display text", format => {
    const buffer = workbook(format);
    expectLatestDay(buffer, 2);
    const parsed = parseUploadedFile(buffer);
    expect(parsed.rows.map(row => row._raw.Day)).toEqual(["2026-09-01", "2026-11-06"]);
    const raw = parseUploadedFileHeadersAndRows(buffer);
    expect(raw.dataRows.map(row => row[2])).toEqual(["2026-09-01", "2026-11-06"]);
    expect(raw.dataRows[0][3]).toBe("$10.25");
    expect(raw.dataRows[0][8]).toBe("01:12");
  });
  it("builds the weekly report using the workbook's latest day, not yesterday", async () => {
    const parsed = parseUploadedFile(workbook("m/d/yy"));
    const formData = new FormData(); formData.set("reportType", JSON.stringify("WEEKLY")); formData.set("dateSelection", JSON.stringify({mode:"last7"}));
    const client = { id:"fixture",userId:"fixture",accountName:"Workbook",currency:"USD",timezone:"America/New_York",monthlyBudget:null,showBudgetPacingOnCover:false,campaignObjectiveCache:null } as Client;
    const output = await buildStandardReportForWizard({client,platform:"META",mtdParsed:parsed,formData,now});
    if (!("data" in output)) throw new Error(output.error);
    expect(output.data.calculationContext?.primaryRange).toEqual({startIso:"2026-10-31",endIso:"2026-11-06"});
    expect(output.data.campaignSlides[0].metrics.results).toBe("2");
    expect(output.data.campaignSlides[0].metrics.cpr).toBe("$10.38");
  });
  it("still rejects genuinely future source dates rather than disabling validation", () => {
    const book = XLSX.read(workbook("m/d/yy"), {type:"buffer",cellNF:true});
    book.Sheets[book.SheetNames[0]].C3.v = 46697;
    delete book.Sheets[book.SheetNames[0]].C3.w;
    const parsed = parseUploadedFile(XLSX.write(book,{type:"buffer",bookType:"xlsx"}));
    expect(validateMtdDailyCsv(parsed.colMap, parsed.rows, now, parsed.headers, "META").errors.some(error => error.message.includes("future"))).toBe(true);
  });
  it("respects the workbook's 1904 date system", () => expectLatestDay(workbook("m/d/yy", true), 2));
  it.runIf(!!process.env.WORKBOOK_DATE_REPRO_PATH)("accepts the uploaded RV workbook and anchors on November 6", () => {
    expectLatestDay(readFileSync(process.env.WORKBOOK_DATE_REPRO_PATH!), 804);
  });
});
