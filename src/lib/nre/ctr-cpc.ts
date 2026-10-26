import { aggregateNumericFacts } from "./numeric-accounting";
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
  if (row._sourcePlatform === "GOOGLE" && String(row.link_clicks ?? "").trim() !== "") return parseCellNum(row.link_clicks);
  const clicksAll = Object.entries(row._raw ?? {}).find(([header]) => header.trim().toLowerCase() === "clicks (all)");
  if (clicksAll && clicksAll[1] !== "") return parseCellNum(clicksAll[1]);
  const ctr = parseCellNum(row.ctr);
  if (impressions > 0 && ctr > 0) return (ctr / 100) * impressions;
  const cpcHeaders = Object.keys(row._raw ?? {}).map(header => header.trim().toLowerCase());
  const linkOnlyCpc = cpcHeaders.some(header => /cost per link click/.test(header)) && !cpcHeaders.some(header => /^(?:cpc \(all\)|cpc|avg\. cpc|average cpc)$/.test(header));
  const cpc = linkOnlyCpc ? 0 : parseCellNum(row.cpc);
  if (cpc > 0 && spend > 0) return spend / cpc;
  return 0;
}

/** Meta-style blended CTR (all) and CPC (all) for a row set. */
export function combinedCtrCpcFromRows(rows: MetricRow[]): { ctr: number; cpc: number } {
  const totals = aggregateNumericFacts(rows.map(row => {
    const spend = parseCellNum(row.spend), impressions = parseCellNum(row.impressions);
    return { spend, impressions, clicksAll: impliedClicks(row, spend, impressions), results: 0 };
  }));
  return { ctr: totals.ctr ?? 0, cpc: totals.cpc ?? 0 };
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
  if (candidates === SPEND_HEADER_CANDIDATES) {
    return [...headerMap.entries()].find(([header]) => /^amount spent\s*\([a-z]{3}\)$/.test(header))?.[1];
  }
  return undefined;
}

/** Same formulas as combinedCtrCpcFromRows, reading unmapped `_raw` CSV cells. */
export function combinedCtrCpcFromRawRows(rows: CtrCpcRawRow[], headerMap: Map<string, string>): { ctr: number; cpc: number } {
  const spendHeader = resolveRawHeader(headerMap, SPEND_HEADER_CANDIDATES);
  const imprHeader = headerMap.get("impressions");

  const ctrHeader = resolveRawHeader(headerMap, CTR_ALL_HEADER_CANDIDATES);
  const cpcHeader = resolveRawHeader(headerMap, CPC_ALL_HEADER_CANDIDATES);
  return combinedCtrCpcFromRows(rows.map(row => ({
    _raw: row._raw,
    spend: spendHeader ? row._raw[spendHeader] : 0,
    impressions: imprHeader ? row._raw[imprHeader] : 0,
    ctr: ctrHeader ? row._raw[ctrHeader] : 0,
    cpc: cpcHeader ? row._raw[cpcHeader] : 0,
  })));
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
