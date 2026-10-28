import { aggregateSourceRatio } from "./source-ratio";
import type { MetricAggregation } from "./metric-aggregation";
/**
 * Aggregate optional metrics from original CSV observations in the selected scope.
 * Dictionary metadata defines numerator/denominator semantics independently of
 * display format. Primary result chips use the report's resolved accounting;
 * optional tracking metrics retain their own event/location definitions.
 */

import type { MetricFormat } from "./meta-dictionary";
import { formatMetricValue, parseCellNum } from "./format";
import { META_METRIC_DICTIONARY } from "./meta-dictionary";
import { GOOGLE_METRIC_DICTIONARY } from "./google-dictionary";
import { aggregateReach } from "./reach-aggregation";
import {
  blendedCostPerLinkClickFromRawRows,
  combinedCtrCpcFromRawRows,
} from "./ctr-cpc";
import type { MetricRow } from "./types";

/** Any raw CSV row shape that still carries its original column values — both NreRow (Meta) and GoogleRow (Google) satisfy this. */
export interface RawMetricRow {
  _raw: Record<string, string>;
}

/** The minimal shape aggregateDynamicMetrics needs to read one metric's value(s) off raw CSV rows — a dictionary entry's own key/format/csvName/perUnitOf/perUnitScale, independent of any particular selection mechanism (see slot-assignment.ts, the sole caller now that the wizard's metric-selector.ts is gone). */
export interface MetricRef extends MetricAggregation {
  key: string;
  format: MetricFormat;
  csvName: string;
  perUnitOf?: string;
  perUnitScale?: number;
}

/** One metric card slot's resolved display value for a single campaign/ad-set slide — see slot-assignment.ts, which builds this per the objective-based slot mapping. `perUnitOf` is carried through so the PPT render layer (fill-tags.ts/metric-icons.ts) can pick the right icon without a second dictionary lookup. */
export interface DynamicMetricValue {
  key: string;
  label: string;
  format: MetricFormat;
  value: string;
  perUnitOf?: string;
}

/**
 * Resolves `key` (e.g. "spend", "results", "website_leads") to the actual
 * CSV header text present in THIS row group, trying every dictionary entry
 * that shares that key — not just the first ("amount spent (usd)" is
 * declared before "amount spent" in meta-dictionary.ts, but a non-USD
 * account's CSV only ever has the latter). Picking only the first variant
 * silently resolved to 0 whenever the CSV happened to use a different
 * variant of the same underlying metric — a real bug caught by
 * dynamic-metrics.test.ts, not just a hypothetical.
 */
/**
 * After normalizeGoogleCsvHeaders, unified-pipeline Google CSV uses Meta-shaped
 * column names — map Google metric keys to those headers for slot lookup.
 */
const GOOGLE_UNIFIED_CSV_ALIASES: Partial<Record<string, string[]>> = {
  cost: ["amount spent"],
  clicks: ["link clicks"],
  ctr: ["ctr (all)"],
  avg_cpc: ["cpc (cost per link click)"],
  conversions: ["results"],
  cost_per_conv: ["cost per result"],
};

function resolveActualHeader(key: string, platform: "meta" | "google", headerMap: Map<string, string>): string | undefined {
  const dictionary = platform === "google" ? GOOGLE_METRIC_DICTIONARY : META_METRIC_DICTIONARY;
  for (const entry of dictionary) {
    if (entry.key !== key) continue;
    if (entry.type !== "primary" && entry.type !== "secondary") continue;
    const header = headerMap.get(entry.csvName);
    if (header) return header;
  }
  if (platform === "meta") {
    for (const [normalized, actual] of headerMap) {
      const stripped = normalized.replace(/\s*\([a-z]{3}\)$/, "");
      if (stripped !== normalized && dictionary.some(entry => entry.key === key && entry.csvName === stripped)) return actual;
    }
  }
  if (platform === "google") {
    for (const alias of GOOGLE_UNIFIED_CSV_ALIASES[key] ?? []) {
      const header = headerMap.get(alias);
      if (header) return header;
    }
  }
  return undefined;
}

/** All-click and link-click CPC retain distinct denominators. */
const CPC_METRIC_KEYS = new Set(["cpc_all", "cpc_link_click"]);
/** All-click CPC cannot use a link-click denominator. */
const CPC_ALL_CLICKS_HEADER_CANDIDATES = ["clicks (all)", "clicks"];
const CPC_LINK_CLICKS_HEADER_CANDIDATES = ["link clicks"];

function aggregateCpc<T extends RawMetricRow>(
  rows: T[],
  headerMap: Map<string, string>,
  totalSpend: number,
  metricKey: "cpc_all" | "cpc_link_click",
): number {
  const canonicalCountHeader = resolveActualHeader(metricKey === "cpc_all" ? "clicks_all" : "link_clicks", "meta", headerMap);
  const canonicalSpendHeader = resolveActualHeader("spend", "meta", headerMap) ?? resolveActualHeader("cost", "google", headerMap);
  const canonicalRateHeader = resolveActualHeader(metricKey, "meta", headerMap);
  if (canonicalCountHeader) {
    const count = rows.reduce((sum, row) => sum + parseCellNum(row._raw[canonicalCountHeader]), 0);
    if (!(count > 0)) return NaN;
    if (canonicalSpendHeader) return totalSpend / count;
    return aggregateSourceRatio(rows, undefined, canonicalCountHeader, canonicalRateHeader);
  }
  if (metricKey === "cpc_all") {
    const { cpc } = combinedCtrCpcFromRawRows(rows, headerMap);
    if (cpc > 0) return cpc;
  }

  if (metricKey === "cpc_link_click") {
    const blended = blendedCostPerLinkClickFromRawRows(rows, headerMap);
    if (Number.isFinite(blended) && blended > 0) return blended;
  }

  const clickHeaders =
    metricKey === "cpc_link_click" ? CPC_LINK_CLICKS_HEADER_CANDIDATES : CPC_ALL_CLICKS_HEADER_CANDIDATES;

  for (const candidate of clickHeaders) {
    const header = headerMap.get(candidate);
    if (!header) continue;
    const totalClicks = rows.reduce((sum, r) => sum + parseCellNum(r._raw?.[header]), 0);
    if (totalClicks > 0 && totalSpend > 0) return totalSpend / totalClicks;
  }

  const rateCandidates = metricKey === "cpc_link_click" ? ["cpc (cost per link click)"] : ["cpc (all)", "avg. cpc", "average cpc"];
  const rateHeader = canonicalRateHeader ?? rateCandidates.map(key => headerMap.get(key)).find(Boolean);
  const countHeader = clickHeaders.map(key => headerMap.get(key)).find(Boolean);
  // Counts already supplied as zero must not be replaced by a contradictory rate.
  if (countHeader && rows.reduce((sum, row) => sum + parseCellNum(row._raw[countHeader]), 0) === 0) return NaN;
  const spendHeader = resolveActualHeader("spend", "meta", headerMap) ?? resolveActualHeader("cost", "google", headerMap);
  return aggregateSourceRatio(rows, spendHeader, countHeader, rateHeader);
}

/** Prefer conversion-value/spend totals; otherwise use spend-weighted exported ROAS.
 * Never average daily ROAS values or substitute a different conversion location.
 */
const ROAS_METRIC_KEYS = new Set(["results_roas", "roas", "app_purchase_roas"]);
const ROAS_CONVERSION_VALUE_HEADER_CANDIDATES = ["purchases conversion value", "purchase conversion value", "conv. value", "conversion value"];

function aggregateRoas<T extends RawMetricRow>(rows: T[], headerMap: Map<string, string>, totalSpend: number, key: string): number {
  const sourcePlatform = key === "roas" ? "google" : "meta";
  const rateHeader = resolveActualHeader(key, sourcePlatform, headerMap);
  const spendHeader = resolveActualHeader(key === "roas" ? "cost" : "spend", sourcePlatform, headerMap);
  const candidates = key === "app_purchase_roas" ? ["mobile app purchases conversion value", "mobile app purchase conversion value"] : ROAS_CONVERSION_VALUE_HEADER_CANDIDATES;
  for (const candidate of candidates) {
    const header = headerMap.get(candidate);
    if (!header) continue;
    if (spendHeader) {
      const totalConversionValue = rows.reduce((sum, r) => sum + parseCellNum(r._raw?.[header]), 0);
      return totalSpend > 0 ? totalConversionValue / totalSpend : NaN;
    }
    // An extra conversion-value column must not suppress a standalone observed ratio.
    return aggregateSourceRatio(rows, undefined, undefined, rateHeader);
  }
  return aggregateSourceRatio(rows, undefined, spendHeader, rateHeader);
}

/**
 * Add totals; recompute declared ratios from their components. An exported
 * average is never additive merely because it is formatted as currency.
 * Missing components can be recovered only from a matching exported rate and
 * its row-level weight. A single observed rate can be retained on its own.
 * The legacy __avg__ bid-target policy is
 * preserved separately and is not a claim of traffic-weighted target parity.
 */
export function aggregateDynamicMetrics<T extends RawMetricRow>(
  rows: T[],
  metrics: MetricRef[],
  platform: "meta" | "google",
): Record<string, number> {
  const result: Record<string, number> = {};
  if (rows.length === 0 || metrics.length === 0) return result;

  // Every row shares the same _raw header set (built from one shared CSV
  // header row in columns.ts), so resolving header casing/whitespace once
  // against the first row is safe and avoids re-resolving per row.
  const headerMap = new Map<string, string>();
  for (const header of Object.keys(rows[0]._raw || {})) {
    headerMap.set(header.trim().toLowerCase(), header);
  }

  const sumByKey = (key: string): number => {
    const actualHeader = resolveActualHeader(key, platform, headerMap);
    if (!actualHeader) return 0;
    return rows.reduce((sum, r) => sum + parseCellNum(r._raw?.[actualHeader]), 0);
  };

  const spendKey = platform === "google" ? "cost" : "spend";
  let totalSpend: number | null = null;

  for (const metric of metrics) {
    const dictionary = platform === "google" ? GOOGLE_METRIC_DICTIONARY : META_METRIC_DICTIONARY;
    const definition = dictionary.find(entry => entry.key === metric.key && entry.csvName === (metric.csvName ?? "").toLowerCase()) ?? dictionary.find(entry => entry.key === metric.key);
    // Daily unique viewers cannot establish a deduplicated period audience.
    if (metric.key === "unique_video_viewers" && rows.length > 1) {
      result[metric.key] = NaN;
      continue;
    }
    const perUnitOf = metric.perUnitOf ?? definition?.perUnitOf;
    const perUnitScale = metric.perUnitScale ?? definition?.perUnitScale ?? 1;
    const numeratorKey = metric.numeratorKey ?? definition?.numeratorKey;
    const denominatorKey = metric.denominatorKey ?? definition?.denominatorKey;
    // CPC can be reconstructed from exported per-row rates when its count
    // column is omitted. Do not let the generic ratio guard discard it first.
    if (CPC_METRIC_KEYS.has(metric.key)) {
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      result[metric.key] = aggregateCpc(rows, headerMap, totalSpend, metric.key as "cpc_all" | "cpc_link_click");
      continue;
    }
    if (metric.key === "ctr" && platform === "meta") {
      const clicksHeader = resolveActualHeader("clicks_all", "meta", headerMap);
      const impressionsHeader = resolveActualHeader("impressions", "meta", headerMap);
      const rateHeader = resolveActualHeader("ctr", "meta", headerMap) ?? headerMap.get(metric.csvName);
      result[metric.key] = rateHeader || clicksHeader
        ? aggregateSourceRatio(rows, clicksHeader, impressionsHeader, rateHeader, 100)
        : impressionsHeader ? combinedCtrCpcFromRawRows(rows, headerMap).ctr : NaN;
      continue;
    }
    if (numeratorKey && denominatorKey) {
      // Prefer components; otherwise use only matching, weighted source observations.
      const numeratorHeader = resolveActualHeader(numeratorKey, platform, headerMap);
      const denominatorHeader = resolveActualHeader(denominatorKey, platform, headerMap);
      const rateHeader = resolveActualHeader(metric.key, platform, headerMap) ?? headerMap.get(metric.csvName);
      result[metric.key] = aggregateSourceRatio(rows, numeratorHeader, denominatorHeader, rateHeader, metric.ratioScale ?? definition?.ratioScale ?? 1, denominatorKey !== "reach");
      continue;
    }
    if (metric.key === "frequency") {
      const reachHeader = headerMap.get("reach"), impressionsHeader = headerMap.get("impressions");
      if (reachHeader && impressionsHeader) {
        const mapped = rows.map(row => ({ ...row, reach: row._raw[reachHeader], impressions: row._raw[impressionsHeader] }));
        const reach = aggregateReach(mapped);
        const impressions = rows.reduce((sum, row) => sum + parseCellNum(row._raw[impressionsHeader]), 0);
        result[metric.key] = reach > 0 ? impressions / reach : NaN;
      } else {
        const header = resolveActualHeader(metric.key, platform, headerMap) ?? headerMap.get(metric.csvName);
        result[metric.key] = rows.length === 1 && header ? parseCellNum(rows[0]._raw[header]) : NaN;
      }
      continue;
    }
    if (ROAS_METRIC_KEYS.has(metric.key)) {
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      result[metric.key] = aggregateRoas(rows, headerMap, totalSpend, metric.key);
      continue;
    }

    if (metric.format === "currency" && perUnitOf) {
      const actualHeader = resolveActualHeader(metric.key, platform, headerMap) ?? headerMap.get(metric.csvName);
      if (perUnitOf === "__avg__") {
        if (!actualHeader) continue;
        const rawValues = rows.map((r) => parseCellNum(r._raw?.[actualHeader]));
        const nonZero = rawValues.filter((v) => v > 0);
        result[metric.key] = nonZero.length > 0 ? nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length : NaN;
        continue;
      }
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      const countHeader = resolveActualHeader(perUnitOf, platform, headerMap);
      if (perUnitOf === "reach" && countHeader) {
        const mapped = rows.map(row => ({ ...row, reach: row._raw[countHeader] }));
        const reach = aggregateReach(mapped as MetricRow[]);
        result[metric.key] = reach > 0 ? totalSpend / reach * perUnitScale : NaN;
      } else {
        result[metric.key] = aggregateSourceRatio(rows, resolveActualHeader(spendKey, platform, headerMap), countHeader, actualHeader, perUnitScale, perUnitOf !== "reach");
      }
      continue;
    }

    const actualHeader = resolveActualHeader(metric.key, platform, headerMap) ?? headerMap.get(metric.csvName);
    if (!actualHeader) continue;

    if (metric.format === "text") {
      const firstNonEmpty = rows.map((r) => r._raw?.[actualHeader] ?? "").find((v) => v !== "");
      result[metric.key] = firstNonEmpty ? 1 : 0;
      continue;
    }

    const rawValues = rows.map((r) => parseCellNum(r._raw?.[actualHeader]));
    if (/^(?:average\b|avg[. ])/.test(metric.csvName) || (metric.format === "currency" && /^(?:cost\s*(?:per\b|\/|-)|cpc\b|cpm\b|cpa\b)/i.test(metric.csvName))) {
      result[metric.key] = rows.length === 1 && String(rows[0]._raw[actualHeader] ?? "").trim() !== "" ? rawValues[0] : NaN;
    } else if (metric.format === "currency" || metric.format === "number") {
      result[metric.key] = rawValues.reduce((sum, v) => sum + v, 0);
    } else {
      // An exported daily rate/average lacks a valid period denominator.
      // Preserve a single observation; do not invent a multi-row arithmetic mean.
      const allObservedZero = rawValues.every(value => value === 0) && rows.every(row => String(row._raw[actualHeader] ?? "").trim() !== "");
      result[metric.key] = rows.length === 1 ? rawValues[0] : allObservedZero ? 0 : NaN;
    }
  }

  return result;
}

/**
 * Resolves and formats a SINGLE dictionary entry's aggregated value over
 * `rawRows`, for slot-assignment.ts's per-objective slot-filling (e.g. "how
 * many landing page views did this campaign get, formatted as a number").
 * Both a missing/NaN aggregate (see aggregateDynamicMetrics — e.g. a
 * per-unit cost metric with a zero denominator) AND a genuine raw zero
 * render as "—" here, per the product spec: "if the value is zero or the
 * metric was not present in the CSV, show '—'" — a stricter rule than
 * aggregateDynamicMetrics' own NaN-only convention, deliberately scoped to
 * just this single-slot-value call site rather than changing that shared
 * function's behavior for its other (non-slot) callers.
 */
export function lookupMetricValue<T extends RawMetricRow>(
  rawRows: T[],
  metric: MetricRef,
  platform: "meta" | "google",
  currencySymbol: string,
): string {
  const raw = aggregateDynamicMetrics(rawRows, [metric], platform)[metric.key];
  if (raw === undefined || Number.isNaN(raw) || raw === 0) return "—";
  return formatMetricValue(raw, metric.format, currencySymbol);
}
