import { parseCellNum } from "./format";
import type { MetricRow } from "./types";

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
