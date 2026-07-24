/**
 * Universal file-upload entry point — accepts whatever format a user
 * downloads from Meta Ads Manager or Google Ads (.csv, .tsv, .txt, .xlsx,
 * .xls, .ods) and normalizes it down to the same ParsedCsv shape parseCsvText
 * already produces, so every downstream consumer (column detection,
 * validation, report generation) is completely unchanged and format-agnostic.
 *
 * File type is detected from magic bytes, not the filename extension —
 * extensions lie (a renamed file, a misconfigured export) but the first few
 * bytes of a real .xlsx/.xls file don't.
 */

import * as XLSX from "xlsx";
import { parseCsvText, type ParsedCsv } from "./parse-csv";

export type DetectedFileKind = "excel" | "text";

const ZIP_MAGIC = [0x50, 0x4b]; // "PK" — .xlsx/.ods (zip-based)
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // legacy .xls

function startsWith(buffer: Buffer, magic: number[]): boolean {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

/** Detects file type from magic bytes — .xlsx/.ods are zip archives (PK..), legacy .xls is OLE2 (D0 CF 11 E0 ...). */
export function detectFileKind(buffer: Buffer): DetectedFileKind {
  if (startsWith(buffer, ZIP_MAGIC)) return "excel";
  if (startsWith(buffer, OLE2_MAGIC)) return "excel";
  return "text";
}

/**
 * Decodes a raw byte buffer to text, handling UTF-16 (LE/BE, detected via
 * BOM) in addition to UTF-8. A leading UTF-8 BOM is stripped by
 * parseCsvText's own stripBom() — this only handles the encoding itself,
 * since UTF-16 bytes can't be decoded correctly as UTF-8 in the first place.
 */
export function decodeTextBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function sheetHasData(sheet: XLSX.WorkSheet): boolean {
  return !!sheet["!ref"];
}

/**
 * Picks which sheet to read: an exact (case-insensitive) name match for
 * `preferredSheetName` first, then a sheet whose name contains it (or vice
 * versa) as a substring, then the first sheet that has any data at all.
 */
export function pickSheetName(workbook: XLSX.WorkBook, preferredSheetName?: string): string | null {
  if (workbook.SheetNames.length === 0) return null;

  if (preferredSheetName) {
    const preferred = preferredSheetName.toLowerCase().trim();
    const exact = workbook.SheetNames.find((name) => name.toLowerCase().trim() === preferred);
    if (exact) return exact;

    const partial = workbook.SheetNames.find((name) => {
      const n = name.toLowerCase().trim();
      return n.includes(preferred) || preferred.includes(n);
    });
    if (partial) return partial;
  }

  const withData = workbook.SheetNames.find((name) => sheetHasData(workbook.Sheets[name]));
  return withData ?? workbook.SheetNames[0];
}

function parseExcelBuffer(buffer: Buffer, preferredSheetName?: string): ParsedCsv {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = pickSheetName(workbook, preferredSheetName);
  if (!sheetName) return { colMap: {}, rows: [], headers: [] };

  const sheet = workbook.Sheets[sheetName];
  // Converting to CSV text (rather than reading cells directly) reuses the
  // exact same delimiter-agnostic parsing, BOM handling, and column
  // detection as every other format — one code path for all formats,
  // instead of a parallel cell-reading implementation to keep in sync.
  const csvText = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
  return parseCsvText(csvText);
}

/**
 * Parses an uploaded file buffer of any supported format into the same
 * ParsedCsv shape. `preferredSheetName` is only used for Excel workbooks —
 * pass e.g. "MTD Daily CSV" for the MTD Daily upload slot.
 */
export function parseUploadedFile(buffer: Buffer, preferredSheetName?: string): ParsedCsv {
  if (buffer.length === 0) return { colMap: {}, rows: [], headers: [] };

  const kind = detectFileKind(buffer);
  if (kind === "excel") {
    return parseExcelBuffer(buffer, preferredSheetName);
  }
  return parseCsvText(decodeTextBuffer(buffer));
}
