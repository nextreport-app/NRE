import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { decodeTextBuffer, detectFileKind, parseUploadedFile, pickSheetName } from "../parse-file";

const HEADERS = ["Campaign name", "Day", "Amount spent (USD)", "Results"];
const ROW = ["Shoes", "22-07-26", "100", "5"];

function buildWorkbookBuffer(sheets: Record<string, (string | number)[][]>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("detectFileKind", () => {
  it("detects .xlsx/.ods (zip-based) via the PK magic bytes", () => {
    const buffer = buildWorkbookBuffer({ Sheet1: [HEADERS, ROW] });
    expect(detectFileKind(buffer)).toBe("excel");
  });

  it("detects legacy .xls via OLE2 magic bytes", () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    expect(detectFileKind(buffer)).toBe("excel");
  });

  it("treats plain text as text", () => {
    const buffer = Buffer.from(HEADERS.join(",") + "\n" + ROW.join(","));
    expect(detectFileKind(buffer)).toBe("text");
  });

  it("is not fooled by a filename extension mismatch — content decides", () => {
    // A .csv-named file that's actually an xlsx binary should still route to Excel parsing.
    const buffer = buildWorkbookBuffer({ Sheet1: [HEADERS, ROW] });
    expect(detectFileKind(buffer)).toBe("excel");
  });
});

describe("decodeTextBuffer", () => {
  it("decodes plain UTF-8", () => {
    const text = "Campaign name,Day\nShoes,22-07-26";
    expect(decodeTextBuffer(Buffer.from(text, "utf-8"))).toBe(text);
  });

  it("decodes UTF-16LE (BOM-detected)", () => {
    const text = "Campaign name,Day\nShoes,22-07-26";
    const buffer = Buffer.from("﻿" + text, "utf16le");
    expect(decodeTextBuffer(buffer)).toBe(text);
  });

  it("strips a UTF-8 BOM via parseCsvText downstream (decodeTextBuffer itself just decodes)", () => {
    const text = "Campaign name,Day\nShoes,22-07-26";
    const buffer = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf-8")]);
    expect(decodeTextBuffer(buffer).endsWith(text)).toBe(true);
  });
});

describe("pickSheetName", () => {
  it("picks an exact case-insensitive match for the preferred name", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a"]]), "Notes");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["b"]]), "mtd daily csv");
    expect(pickSheetName(workbook, "MTD Daily CSV")).toBe("mtd daily csv");
  });

  it("falls back to the first sheet with data when no name matches", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), "Empty");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([HEADERS, ROW]), "Sheet1");
    expect(pickSheetName(workbook, "MTD Daily CSV")).toBe("Sheet1");
  });

  it("returns null for a workbook with no sheets", () => {
    const workbook = XLSX.utils.book_new();
    expect(pickSheetName(workbook, "MTD Daily CSV")).toBeNull();
  });
});

describe("parseUploadedFile", () => {
  it("parses a plain CSV buffer", () => {
    const buffer = Buffer.from(HEADERS.join(",") + "\n" + ROW.join(","));
    const { colMap, rows } = parseUploadedFile(buffer);
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(rows[0].campaign_name).toBe("Shoes");
  });

  it("finds the 'MTD Daily CSV' tab among several sheets in an .xlsx workbook", () => {
    const buffer = buildWorkbookBuffer({
      "Read me": [["Instructions here"]],
      "MTD Daily CSV": [HEADERS, ROW],
      "Period CSV": [HEADERS, ["Boots", "01-06-26", "50", "2"]],
    });
    const { colMap, rows } = parseUploadedFile(buffer, "MTD Daily CSV");
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(rows).toHaveLength(1);
    expect(rows[0].campaign_name).toBe("Shoes");
    expect(rows[0].spend).toBe("100");
  });

  it("falls back to the first sheet with data when no preferred-name match exists in .xlsx", () => {
    const buffer = buildWorkbookBuffer({ Export: [HEADERS, ROW] });
    const { rows } = parseUploadedFile(buffer, "MTD Daily CSV");
    expect(rows).toHaveLength(1);
    expect(rows[0].campaign_name).toBe("Shoes");
  });

  it("parses a legacy .xls-shaped buffer written by the xlsx package", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([HEADERS, ROW]), "Sheet1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" }) as Buffer;
    const { colMap, rows } = parseUploadedFile(buffer);
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(rows[0].campaign_name).toBe("Shoes");
  });

  it("returns an empty result for an empty buffer", () => {
    const { colMap, rows, headers } = parseUploadedFile(Buffer.alloc(0));
    expect(colMap).toEqual({});
    expect(rows).toEqual([]);
    expect(headers).toEqual([]);
  });

  it("parses a UTF-16LE encoded .txt buffer (auto-detects delimiter and encoding)", () => {
    const text = HEADERS.join("\t") + "\n" + ROW.join("\t");
    const buffer = Buffer.from("﻿" + text, "utf16le");
    const { colMap, rows } = parseUploadedFile(buffer);
    expect(colMap.campaign_name).toBe("Campaign name");
    expect(rows[0].campaign_name).toBe("Shoes");
    expect(rows[0].spend).toBe("100");
  });
});
