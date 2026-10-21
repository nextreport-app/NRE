import { parseCellNum } from "./format";
import type { MetricRow } from "./types";

export interface CtrCpcRawRow {
  _raw: Record<string, string>;
}

const CTR_ALL_HEADER_CANDIDATES = ["ctr (all)", "ctr"];
const CPC_ALL_HEADER_CANDIDATES = ["cpc (all)", "avg. cpc", "average cpc"];
const SPEND_HEADER_CANDIDATES = ["amount spent", "amount spent (usd)"];

/**
 * Back out all-clicks from Meta's CTR (all) or CPC (all) on a single row.
 * Used to blend CTR/CPC across many rows without averaging percentages.
 */
export function impliedClicks(row: MetricRow, spend: number, impressions: number): number {
  const ctr = parseCellNum(row.ctr);
  if (impressions > 0 && ctr > 0) return (ctr / 100) * impressions;
  const cpc = parseCellNum(row.cpc);
  if (cpc > 0 && spend > 0) return spend / cpc;
  return 0;
}

/** Meta-style blended CTR (all) and CPC (all) for a row set. */
export function combinedCtrCpcFromRows(rows: MetricRow[]): { ctr: number; cpc: number } {
  let totalSpend = 0;
  let totalImpr = 0;
  let totalClicks = 0;
  for (const row of rows) {
    const spend = parseCellNum(row.spend);
    const impr = parseCellNum(row.impressions);
    totalSpend += spend;
    totalImpr += impr;
    totalClicks += impliedClicks(row, spend, impr);
  }
  return {
    ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
  };
}

/** Sum of the CSV **Link clicks** column over a window (never Clicks (all)). */
export function sumLinkClicksFromRows(rows: MetricRow[]): number {
  return rows.reduce((sum, row) => sum + parseCellNum(row.link_clicks), 0);
}

/**
 * Cost per link click for a period: total spend ÷ total link clicks.
 * Matches Ads Manager when blending daily export rows — never average daily CPC cells.
 */
export function blendedCostPerLinkClickFromRows(rows: MetricRow[]): number {
  let totalSpend = 0;
  let totalLinkClicks = 0;
  for (const row of rows) {
    totalSpend += parseCellNum(row.spend);
    totalLinkClicks += parseCellNum(row.link_clicks);
  }
  return totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
}

function resolveRawHeader(headerMap: Map<string, string>, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const header = headerMap.get(candidate);
    if (header) return header;
  }
  return undefined;
}

/** Same formulas as combinedCtrCpcFromRows, reading unmapped `_raw` CSV cells. */
export function combinedCtrCpcFromRawRows(rows: CtrCpcRawRow[], headerMap: Map<string, string>): { ctr: number; cpc: number } {
  const spendHeader = resolveRawHeader(headerMap, SPEND_HEADER_CANDIDATES);
  const imprHeader = headerMap.get("impressions");

  let totalSpend = 0;
  let totalImpr = 0;
  let totalClicks = 0;
  for (const row of rows) {
    const raw = row._raw ?? {};
    const spend = spendHeader ? parseCellNum(raw[spendHeader]) : 0;
    const impr = imprHeader ? parseCellNum(raw[imprHeader]) : 0;
    totalSpend += spend;
    totalImpr += impr;

    let ctr = 0;
    for (const candidate of CTR_ALL_HEADER_CANDIDATES) {
      const header = headerMap.get(candidate);
      if (header && raw[header] !== undefined && raw[header] !== "") {
        ctr = parseCellNum(raw[header]);
        break;
      }
    }
    if (impr > 0 && ctr > 0) {
      totalClicks += (ctr / 100) * impr;
      continue;
    }

    let cpc = 0;
    for (const candidate of CPC_ALL_HEADER_CANDIDATES) {
      const header = headerMap.get(candidate);
      if (header && raw[header] !== undefined && raw[header] !== "") {
        cpc = parseCellNum(raw[header]);
        break;
      }
    }
    if (cpc > 0 && spend > 0) totalClicks += spend / cpc;
  }

  return {
    ctr: totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0,
    cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
  };
}

/** Cost per link click from raw CSV: sum spend ÷ sum Link clicks. */
export function blendedCostPerLinkClickFromRawRows(rows: CtrCpcRawRow[], headerMap: Map<string, string>): number {
  const spendHeader = resolveRawHeader(headerMap, SPEND_HEADER_CANDIDATES);
  const linkHeader = headerMap.get("link clicks");
  let totalSpend = 0;
  let totalLinkClicks = 0;
  for (const row of rows) {
    const raw = row._raw ?? {};
    if (spendHeader) totalSpend += parseCellNum(raw[spendHeader]);
    if (linkHeader) totalLinkClicks += parseCellNum(raw[linkHeader]);
  }
  return totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;
}
