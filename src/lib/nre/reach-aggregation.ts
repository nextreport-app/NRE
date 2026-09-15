/**
 * Period reach from Meta daily breakdown exports — reach is NOT additive
 * across days or ad sets. Summing daily reach (what Ads Manager warns
 * against) inflates totals vs campaign-level reporting.
 *
 * Uses the Sainsbury estimator per ad set, then a small overlap correction
 * when multiple ad sets ran in parallel under one campaign.
 */

import { getRowDate } from "./columns";
import { parseCellNum } from "./format";
import type { MetricRow } from "./types";

/** Overlap between parallel ad sets within one campaign (empirical ~5%). */
const AD_SET_OVERLAP_ALPHA = 0.05;

function distinctDays(rows: MetricRow[]): number {
  return new Set(rows.map((r) => getRowDate(r)).filter(Boolean)).size;
}

function distinctAdSetNames(rows: MetricRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    const adSet = String(row.ad_set_name || "").trim();
    if (adSet) names.add(adSet);
  }
  return [...names];
}

/**
 * Sainsbury period-reach estimate for one ad set's daily rows:
 * R = S / (1 + (S/M - 1)/N) where S = sum daily reach, M = max daily reach, N = days.
 */
export function sainsburyPeriodReach(rows: MetricRow[]): number {
  if (!rows.length) return 0;
  const sumReach = rows.reduce((s, r) => s + parseCellNum(r.reach), 0);
  if (sumReach <= 0) return 0;
  if (rows.length === 1) return sumReach;

  const maxReach = Math.max(...rows.map((r) => parseCellNum(r.reach)));
  const nDays = distinctDays(rows);
  if (nDays <= 1) return sumReach;

  return sumReach / (1 + (sumReach / maxReach - 1) / nDays);
}

/** True when rows span multiple days and/or ad sets — plain sums inflate reach. */
export function needsPeriodReachEstimate(rows: MetricRow[]): boolean {
  if (rows.length <= 1) return false;
  return distinctDays(rows) > 1 || distinctAdSetNames(rows).length > 1;
}

/**
 * Estimate deduplicated period reach for a campaign (or ad set) row set.
 * Falls back to a straight sum when the data is already period-level.
 */
export function estimatePeriodReach(rows: MetricRow[]): number {
  if (!rows.length) return 0;
  const sumReach = rows.reduce((s, r) => s + parseCellNum(r.reach), 0);
  if (sumReach <= 0) return 0;
  if (!needsPeriodReachEstimate(rows)) return sumReach;

  const adSetNames = distinctAdSetNames(rows);
  const groups: MetricRow[][] =
    adSetNames.length > 0
      ? adSetNames.map((name) => rows.filter((r) => String(r.ad_set_name || "").trim() === name))
      : [rows];

  const estimates = groups.map((group) => sainsburyPeriodReach(group));
  if (estimates.length === 1) return Math.round(estimates[0]!);

  const sumEst = estimates.reduce((a, b) => a + b, 0);
  const maxEst = Math.max(...estimates);
  const corrected = sumEst - AD_SET_OVERLAP_ALPHA * (sumEst - maxEst) * (estimates.length - 1);
  return Math.round(Math.max(corrected, maxEst));
}

/** Sum reach for additive rows; estimate period reach when daily/ad-set breakdown inflates. */
export function aggregateReach(rows: MetricRow[]): number {
  return estimatePeriodReach(rows);
}

/** Account- or table-wide reach — sum per-campaign estimates (never sum ad sets raw). */
export function aggregateReachAcrossCampaigns(rows: MetricRow[]): number {
  if (!rows.length) return 0;
  const campaigns = new Set(rows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean));
  if (campaigns.size === 0) return aggregateReach(rows);

  let total = 0;
  for (const campaign of campaigns) {
    total += aggregateReach(rows.filter((r) => String(r.campaign_name || "").trim() === campaign));
  }
  return total;
}
