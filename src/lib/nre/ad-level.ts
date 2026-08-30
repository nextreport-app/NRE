/**
 * Ad-level CSV detection and row helpers — used by creative reporting when
 * the uploaded Meta CSV includes an "Ad name" column (Ads-tab export).
 */

import type { ColumnMap, NreRow } from "./columns";

const AD_NAME_KEYWORDS = ["ad name", "ad title"];

/** Returns the CSV header string for the ad name column, if present. */
export function detectAdNameColumn(headers: string[]): string | null {
  for (const header of headers) {
    const h = String(header || "").toLowerCase().trim();
    if (!h) continue;
    if (AD_NAME_KEYWORDS.some((kw) => h === kw || h.includes(kw))) {
      return header;
    }
  }
  return null;
}

export function hasAdLevelData(headers: string[]): boolean {
  return detectAdNameColumn(headers) != null;
}

/** Reads the ad name from a row's raw CSV cells. */
export function getAdName(row: NreRow, adNameColumn: string): string {
  const raw = row._raw?.[adNameColumn];
  if (raw != null && String(raw).trim()) return String(raw).trim();
  return "";
}

/** True when at least one row carries a non-empty ad name. */
export function rowsHaveAdNames(rows: NreRow[], adNameColumn: string): boolean {
  return rows.some((row) => getAdName(row, adNameColumn).length > 0);
}

export function resolveAdNameColumn(colMap: ColumnMap, headers: string[]): string | null {
  const fromHeaders = detectAdNameColumn(headers);
  if (fromHeaders) return fromHeaders;
  // Fallback: scan first row keys when headers array is empty.
  return null;
}
