/**
 * Raw-row aggregation for the dynamic metric dictionary system — reads each
 * selected metric's value straight off `row._raw` (the CSV row's original,
 * un-mapped column values) rather than going through columns.ts's small
 * fixed-field `NreMetricKey` set.
 *
 * This deliberately runs as a SEPARATE pass over the same raw rows
 * aggregate.ts's `aggregateRows` consumes, not a change to it — `_raw` is
 * dropped once `aggregateRows` collapses rows into `AggRow`, and every
 * existing consumer of `AggRow` (Combined Total table, MTD chart, health
 * score) must keep behaving exactly as it does today. Callers pass in
 * whichever raw-row group they need a total for (one campaign's rows, or
 * one ad set's rows) — grouping itself isn't this module's concern.
 */

import type { MetricFormat } from "./meta-dictionary";
import { formatMetricValue, parseCellNum } from "./format";
import { META_METRIC_DICTIONARY } from "./meta-dictionary";
import { GOOGLE_METRIC_DICTIONARY } from "./google-dictionary";

/** Any raw CSV row shape that still carries its original column values — both NreRow (Meta) and GoogleRow (Google) satisfy this. */
export interface RawMetricRow {
  _raw: Record<string, string>;
}

/** The minimal shape aggregateDynamicMetrics needs to read one metric's value(s) off raw CSV rows — a dictionary entry's own key/format/csvName/perUnitOf/perUnitScale, independent of any particular selection mechanism (see slot-assignment.ts, the sole caller now that the wizard's metric-selector.ts is gone). */
export interface MetricRef {
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
function resolveActualHeader(key: string, platform: "meta" | "google", headerMap: Map<string, string>): string | undefined {
  const dictionary = platform === "google" ? GOOGLE_METRIC_DICTIONARY : META_METRIC_DICTIONARY;
  for (const entry of dictionary) {
    if (entry.key !== key) continue;
    if (entry.type !== "primary" && entry.type !== "secondary") continue;
    const header = headerMap.get(entry.csvName);
    if (header) return header;
  }
  return undefined;
}

/**
 * Fix 5 (product report) — CPC (All)/Cost per Link Click were rendering as
 * "—" on real accounts even with plenty of spend and clicks in the CSV.
 * Root cause: the generic perUnitOf branch below always DISCARDS a metric's
 * own raw column value and recomputes purely from spend/count — but the
 * denominator ("clicks_all") is only found if the CSV happens to use the
 * exact column-name variant meta-dictionary.ts already lists for it; a real
 * account's own "CPC (All)"/"Avg. CPC" column, with perfectly good data,
 * was being ignored in favor of a spend/0 = NaN recompute whenever the
 * clicks denominator's own header didn't match.
 *
 * These two CPC keys get their own path instead: try reading the value
 * directly off any of its known column-name variants first (an average of
 * its own non-zero raw values, same treatment a rate/ratio metric gets) —
 * only falling back to spend/clicks when that's genuinely missing or zero,
 * and trying every common "clicks" column name for that fallback too, so a
 * CPC card only ever shows "—" when spend or clicks are truly both absent.
 */
const CPC_METRIC_KEYS = new Set(["cpc_all", "cpc_link_click"]);
const CPC_VALUE_HEADER_CANDIDATES = ["cpc (all)", "avg. cpc", "cpc (cost per link click)", "average cpc"];
const CPC_CLICKS_HEADER_CANDIDATES = ["clicks (all)", "link clicks", "clicks"];

function aggregateCpc<T extends RawMetricRow>(rows: T[], headerMap: Map<string, string>, totalSpend: number): number {
  for (const candidate of CPC_VALUE_HEADER_CANDIDATES) {
    const header = headerMap.get(candidate);
    if (!header) continue;
    const nonZero = rows.map((r) => parseCellNum(r._raw?.[header])).filter((v) => v > 0);
    if (nonZero.length > 0) return nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length;
  }

  for (const candidate of CPC_CLICKS_HEADER_CANDIDATES) {
    const header = headerMap.get(candidate);
    if (!header) continue;
    const totalClicks = rows.reduce((sum, r) => sum + parseCellNum(r._raw?.[header]), 0);
    if (totalClicks > 0) return totalSpend / totalClicks;
  }

  return NaN;
}

/**
 * ROAS bug fix: a CSV's own ROAS/"Purchase ROAS" column is a PER-ROW ratio
 * (that row's conversion value / that row's spend), not something that can
 * ever be validly summed or averaged across rows — averaging it, as the
 * generic ratio branch below does for every other "ratio" metric, produces
 * nonsense the moment most rows have zero spend/conversions and only one
 * row (out of e.g. 7 days in a week) has a purchase: the "average of
 * non-zero values" degenerates to exactly that single day's ROAS, wildly
 * overstating the week's real performance.
 *
 * The only correct weekly/MTD ROAS is sum(conversion value) / sum(spend)
 * over the whole window — computed here from real totals, and the CSV's own
 * ROAS column is never read for this at all (see ROAS_METRIC_KEYS below,
 * checked before the generic per-metric csvName lookup). If no conversion-
 * value column is present in this CSV, this returns NaN — callers render
 * NaN as "—" — rather than ever falling back to the wrong per-row column.
 */
const ROAS_METRIC_KEYS = new Set(["results_roas", "roas"]);
const ROAS_CONVERSION_VALUE_HEADER_CANDIDATES = ["purchases conversion value", "purchase conversion value", "conv. value", "conversion value"];

function aggregateRoas<T extends RawMetricRow>(rows: T[], headerMap: Map<string, string>, totalSpend: number): number {
  for (const candidate of ROAS_CONVERSION_VALUE_HEADER_CANDIDATES) {
    const header = headerMap.get(candidate);
    if (!header) continue;
    const totalConversionValue = rows.reduce((sum, r) => sum + parseCellNum(r._raw?.[header]), 0);
    return totalSpend > 0 ? totalConversionValue / totalSpend : NaN;
  }
  return NaN;
}

/**
 * Sums currency/number metrics; averages non-zero values for
 * percentage/ratio/duration metrics — the same treatment the existing
 * fixed-field pipeline already gives CTR/CPC (a straight sum would be
 * meaningless for a rate or a per-unit average).
 *
 * Per-unit currency metrics (a "cost per X" / CPC / CPM-style average —
 * see MetricRef.perUnitOf) are a further special case: THESE must
 * never be summed either — summing a per-day "cost per lead" across 30 CSV
 * rows produces a meaningless number. Instead they're recomputed as
 * sum(spend) / sum(<perUnitOf column>) [× perUnitScale] over the same row
 * group, matching how a real cost-per-result is actually calculated. A
 * zero denominator (no results/leads/clicks/etc. yet) resolves to NaN
 * rather than 0 or a divide-by-zero — callers (report-data.ts/
 * google-report-data.ts) render NaN as "—", never "$0.00" or "$NaN".
 * perUnitOf: "__avg__" (e.g. Target CPA, a configured bid, not something
 * derived from spend/count) instead averages the metric's own non-zero raw
 * values, same as a percentage/ratio metric.
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
    if (CPC_METRIC_KEYS.has(metric.key)) {
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      result[metric.key] = aggregateCpc(rows, headerMap, totalSpend);
      continue;
    }

    if (ROAS_METRIC_KEYS.has(metric.key)) {
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      result[metric.key] = aggregateRoas(rows, headerMap, totalSpend);
      continue;
    }

    if (metric.format === "currency" && metric.perUnitOf) {
      const actualHeader = headerMap.get(metric.csvName);
      if (metric.perUnitOf === "__avg__") {
        if (!actualHeader) continue;
        const rawValues = rows.map((r) => parseCellNum(r._raw?.[actualHeader]));
        const nonZero = rawValues.filter((v) => v > 0);
        result[metric.key] = nonZero.length > 0 ? nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length : NaN;
        continue;
      }
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      const totalCount = sumByKey(metric.perUnitOf);
      result[metric.key] = totalCount > 0 ? (totalSpend / totalCount) * (metric.perUnitScale ?? 1) : NaN;
      continue;
    }

    const actualHeader = headerMap.get(metric.csvName);
    if (!actualHeader) continue;

    if (metric.format === "text") {
      const firstNonEmpty = rows.map((r) => r._raw?.[actualHeader] ?? "").find((v) => v !== "");
      result[metric.key] = firstNonEmpty ? 1 : 0;
      continue;
    }

    const rawValues = rows.map((r) => parseCellNum(r._raw?.[actualHeader]));
    if (metric.format === "currency" || metric.format === "number") {
      result[metric.key] = rawValues.reduce((sum, v) => sum + v, 0);
    } else {
      const nonZero = rawValues.filter((v) => v > 0);
      result[metric.key] = nonZero.length > 0 ? nonZero.reduce((sum, v) => sum + v, 0) / nonZero.length : 0;
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
