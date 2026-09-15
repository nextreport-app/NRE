/**
 * TikTok Ads CSV header normalization — maps TikTok Ads Manager export
 * column names to the Meta-shaped headers the NRE pipeline expects.
 * Aliases live in tiktok-objective-dictionary.ts.
 */

import { readRowsWithAutoMap, type NreRow } from "@/lib/nre/columns";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { normalizeGoogleCsvHeaders, type Platform } from "@/lib/nre/google-columns";
import { normalizeTikTokResultTypeCell, TIKTOK_CSV_HEADER_ALIASES } from "@/lib/nre/tiktok-objective-dictionary";

export function normalizeTikTokCsvHeaders(headers: string[]): string[] {
  return headers.map((h) => {
    const lower = String(h).toLowerCase().trim();
    return TIKTOK_CSV_HEADER_ALIASES[lower] ?? h;
  });
}

/** Normalize Result type cell values so they match dictionary aliases / Meta map. */
export function normalizeTikTokCsvRowValues(headers: string[], dataRows: string[][]): string[][] {
  const resultTypeIdx = headers.findIndex((h) => h.toLowerCase().trim() === "result type");
  if (resultTypeIdx < 0) return dataRows;
  return dataRows.map((row) => {
    const copy = [...row];
    const cell = copy[resultTypeIdx];
    if (cell?.trim()) copy[resultTypeIdx] = normalizeTikTokResultTypeCell(cell);
    return copy;
  });
}

/** Google Ads uses clicks as reach in client-facing tables (no Meta-style Reach column). */
function applyGoogleReachFallback(rows: NreRow[]): void {
  rows.forEach((row) => {
    if (!row.reach?.trim() && row.link_clicks?.trim()) {
      row.reach = row.link_clicks;
    }
  });
}

/** Parses MTD CSV for Meta, TikTok, or Google — non-Meta platforms normalize headers to Meta shape first. */
export function parseMtdCsvForAdPlatform(buffer: Buffer, platform: Platform) {
  if (platform === "TIKTOK") {
    const { headers, dataRows } = parseUploadedFileHeadersAndRows(buffer, "MTD Daily CSV");
    const normalizedHeaders = normalizeTikTokCsvHeaders(headers);
    const normalizedRows = normalizeTikTokCsvRowValues(normalizedHeaders, dataRows);
    const { colMap, rows } = readRowsWithAutoMap(normalizedHeaders, normalizedRows);
    return { colMap, rows, headers: normalizedHeaders };
  }
  if (platform === "GOOGLE") {
    const { headers, dataRows } = parseUploadedFileHeadersAndRows(buffer, "MTD Daily CSV");
    const normalizedHeaders = normalizeGoogleCsvHeaders(headers);
    const { colMap, rows } = readRowsWithAutoMap(normalizedHeaders, dataRows);
    applyGoogleReachFallback(rows);
    return { colMap, rows, headers: normalizedHeaders };
  }
  return parseUploadedFile(buffer, "MTD Daily CSV");
}
