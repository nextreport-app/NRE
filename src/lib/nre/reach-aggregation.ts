/**
 * Period reach from Meta daily breakdown exports — reach is NOT additive
 * across days or ad sets. Summing daily reach (what Ads Manager warns
 * against) inflates totals vs campaign-level reporting.
 *
 * When Meta campaign-level period reach is available (API), use it for
 * campaign-scoped totals. Otherwise fall back to the Sainsbury estimator
 * per ad set plus overlap correction across parallel ad sets.
 */

import { getRowDate } from "./columns";
import { parseCellNum } from "./format";
import type { DateRangeIso } from "./date-range";
import { lookupMetaCampaignPeriodReach, type MetaCampaignPeriodReachMaps } from "./campaign-period-reach-maps";
import type { MetricRow } from "./types";

export type { MetaCampaignPeriodReachMaps } from "./campaign-period-reach-maps";

/** Overlap between parallel ad sets within one campaign (empirical ~5%). */
const AD_SET_OVERLAP_ALPHA = 0.05;

export type ReachAggregationScope = "campaign" | "adset";

export interface ReachAggregationOptions {
  metaCampaignPeriodReach?: MetaCampaignPeriodReachMaps;
  /** Ads Manager period for API reach lookup */
  periodRange?: DateRangeIso;
  scope?: ReachAggregationScope;
}

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

function distinctCampaignNames(rows: MetricRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    const camp = String(row.campaign_name || "").trim();
    if (camp) names.add(camp);
  }
  return [...names];
}

function tryMetaCampaignPeriodReach(rows: MetricRow[], opts?: ReachAggregationOptions): number | undefined {
  if (!opts?.metaCampaignPeriodReach || !opts.periodRange || opts.scope === "adset") return undefined;
  const campaigns = distinctCampaignNames(rows);
  if (campaigns.length !== 1) return undefined;
  const lookup = lookupMetaCampaignPeriodReach(
    opts.metaCampaignPeriodReach,
    campaigns[0]!,
    opts.periodRange.startIso,
    opts.periodRange.endIso,
  );
  return lookup != null && lookup > 0 ? Math.round(lookup) : undefined;
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
export function estimatePeriodReach(rows: MetricRow[], opts?: ReachAggregationOptions): number {
  const apiReach = tryMetaCampaignPeriodReach(rows, opts);
  if (apiReach != null) return apiReach;

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
export function aggregateReach(rows: MetricRow[], opts?: ReachAggregationOptions): number {
  return estimatePeriodReach(rows, opts);
}

/** Account- or table-wide reach — sum per-campaign estimates (never sum ad sets raw). */
export function aggregateReachAcrossCampaigns(rows: MetricRow[], opts?: ReachAggregationOptions): number {
  if (!rows.length) return 0;
  const campaigns = new Set(rows.map((r) => String(r.campaign_name || "").trim()).filter(Boolean));
  if (campaigns.size === 0) return aggregateReach(rows, opts);

  let total = 0;
  for (const campaign of campaigns) {
    const campRows = rows.filter((r) => String(r.campaign_name || "").trim() === campaign);
    total += aggregateReach(campRows, {
      ...opts,
      scope: opts?.scope ?? "campaign",
    });
  }
  return total;
}

/** Normalize keys on a flat campaign → reach map from the client. */
export function normalizeCampaignPeriodReachRecord(byCampaign: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, reach] of Object.entries(byCampaign)) {
    if (!Number.isFinite(reach) || reach <= 0) continue;
    out[String(name || "Unknown Campaign").trim().toLowerCase()] = Math.round(reach);
  }
  return out;
}
