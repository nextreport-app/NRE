/**
 * TikTok Ads CSV header normalization — maps TikTok Ads Manager export
 * column names to the Meta-shaped headers the NRE pipeline expects.
 */

import { readRowsWithAutoMap } from "@/lib/nre/columns";
import { parseUploadedFile, parseUploadedFileHeadersAndRows } from "@/lib/nre/parse-file";
import type { Platform } from "@/lib/nre/google-columns";

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

/** Parses MTD CSV for Meta or TikTok — TikTok headers are normalized to Meta shape first. */
export function parseMtdCsvForAdPlatform(buffer: Buffer, platform: Platform) {
  if (platform === "TIKTOK") {
    const { headers, dataRows } = parseUploadedFileHeadersAndRows(buffer, "MTD Daily CSV");
    const normalizedHeaders = normalizeTikTokCsvHeaders(headers);
    const { colMap, rows } = readRowsWithAutoMap(normalizedHeaders, dataRows);
    return { colMap, rows, headers: normalizedHeaders };
  }
  return parseUploadedFile(buffer, "MTD Daily CSV");
}
