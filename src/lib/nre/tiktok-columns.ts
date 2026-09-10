/**
 * TikTok Ads CSV header normalization — maps TikTok Ads Manager export
 * column names to the Meta-shaped headers the NRE pipeline expects.
 */

import { readRowsWithAutoMap, type NreRow } from "@/lib/nre/columns";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import { normalizeGoogleCsvHeaders, type Platform } from "@/lib/nre/google-columns";

export function normalizeTikTokCsvHeaders(headers: string[]): string[] {
  return headers.map((h) => {
    const lower = String(h).toLowerCase().trim();
    if (lower === "cost" || lower === "total cost") return "Amount spent (USD)";
    if (lower === "ad group name" || lower === "adgroup name") return "Ad set name";
    if (lower === "clicks (destination)" || lower === "clicks") return "Link clicks";
    if (lower === "cpc (destination)" || lower === "cpc") return "CPC (cost per link click)";
    if (lower === "ctr (destination)" || lower === "ctr") return "CTR (All)";
    if (lower === "conversions" || lower === "conversion") return "Results";
    if (lower === "cost per conversion") return "Cost per result";
    if (lower === "day" || lower === "date") return "Day";
    return h;
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
    const { colMap, rows } = readRowsWithAutoMap(normalizedHeaders, dataRows);
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
