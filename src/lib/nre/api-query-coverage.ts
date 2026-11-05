import type { NreRow } from "./columns";
export const API_RANGE_START_HEADER = "NRE API range start";
export const API_RANGE_END_HEADER = "NRE API range end";
/** API query coverage is metadata, not a fabricated observation for missing days. */
export function apiQueryCoverage(rows: NreRow[]): { startIso: string; endIso: string } | null {
  const first = rows[0]?._raw;
  const startIso = first?.[API_RANGE_START_HEADER];
  const endIso = first?.[API_RANGE_END_HEADER];
  if (!startIso || !endIso || !/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso) || startIso > endIso) return null;
  if (!Number.isFinite(Date.parse(startIso)) || !Number.isFinite(Date.parse(endIso))) return null;
  if (!rows.every(row => row._raw?.[API_RANGE_START_HEADER] === startIso && row._raw?.[API_RANGE_END_HEADER] === endIso)) return null;
  return { startIso, endIso };
}
