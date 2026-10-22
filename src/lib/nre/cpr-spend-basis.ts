import type { MetricRow } from "./types";
import { parseCellNum } from "./format";

/**
 * CPR denominator for a campaign (or ad-set) window: sum of every daily row's
 * Amount spent in that window — matches the Ad Spend card on campaign slides
 * and Ads Manager campaign-level exports. Attributed-spend subsets caused
 * ~$9.75 vs ~$17 CPL while verification still passed (it recomputed CPR from
 * totals, not from the number printed on the slide).
 */
export function sumAllRowSpendInPeriod(rows: MetricRow[]): number {
  return rows.reduce((s, row) => s + parseCellNum(row.spend), 0);
}
