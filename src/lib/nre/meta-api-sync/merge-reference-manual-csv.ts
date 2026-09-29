import { parseCsvText } from "../parse-csv";
import type { NreRow } from "../columns";
import { rowsToCsv } from "../rows-to-csv";

function isoDayFromRow(row: NreRow): string {
  const raw = (row._raw?.Day ?? row.date_start ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return raw;
}

function rowKey(row: NreRow): string {
  const camp = (row.campaign_name ?? "").trim().toLowerCase();
  const adset = (row.ad_set_name ?? "").trim().toLowerCase();
  return `${camp}\0${adset}\0${isoDayFromRow(row)}`;
}

function isResultColumnHeader(header: string): boolean {
  const h = header.toLowerCase();
  return (
    h.includes("result type") ||
    h === "results" ||
    h.includes("cost per result") ||
    h.includes("meta lead") ||
    h.includes("website lead") ||
    h.includes("results (initial)")
  );
}

/** Copies manual export Result columns onto API rows (same campaign + ad set + day). */
function mergeResultColumnsFromReference(apiRow: NreRow, refRow: NreRow): NreRow {
  const _raw = { ...apiRow._raw };
  for (const [header, value] of Object.entries(refRow._raw ?? {})) {
    if (isResultColumnHeader(header)) {
      _raw[header] = value;
    }
  }
  return {
    ...apiRow,
    result_type: refRow.result_type,
    results: refRow.results,
    cpr: refRow.cpr,
    website_leads: refRow.website_leads,
    meta_leads: refRow.meta_leads,
    leads: refRow.leads,
    _raw,
  };
}

function rowsToCsvText(headers: string[], rows: NreRow[]): string {
  const dataRows = rows.map((row) => headers.map((h) => row._raw[h] ?? ""));
  return rowsToCsv(headers, dataRows);
}

/**
 * Meta Insights cannot always reproduce manual export Results. When the user
 * provides their Ads Manager CSV, keep its Result type / Results / CPR per day
 * and use API rows for spend, reach, impressions, and clicks.
 */
export function mergeApiCsvWithManualReference(apiCsvText: string, manualCsvText: string): string {
  const api = parseCsvText(apiCsvText);
  const manual = parseCsvText(manualCsvText);
  if (manual.rows.length === 0) return apiCsvText;

  const refByKey = new Map<string, NreRow>();
  for (const row of manual.rows) {
    const key = rowKey(row);
    if (key.endsWith("\0")) continue;
    refByKey.set(key, row);
  }

  const merged: NreRow[] = api.rows.map((row) => {
    const ref = refByKey.get(rowKey(row));
    return ref ? mergeResultColumnsFromReference(row, ref) : row;
  });

  const mergedKeys = new Set(merged.map(rowKey));
  for (const row of manual.rows) {
    const key = rowKey(row);
    if (!mergedKeys.has(key)) {
      merged.push(row);
      mergedKeys.add(key);
    }
  }

  return rowsToCsvText(api.headers, merged);
}
