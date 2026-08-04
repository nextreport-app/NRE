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

import type { SelectedMetric } from "./metric-selector";
import { formatMetricValue, parseCellNum } from "./format";
import { META_METRIC_DICTIONARY } from "./meta-dictionary";
import { GOOGLE_METRIC_DICTIONARY } from "./google-dictionary";

/** Any raw CSV row shape that still carries its original column values — both NreRow (Meta) and GoogleRow (Google) satisfy this. */
export interface RawMetricRow {
  _raw: Record<string, string>;
}

/** One dynamically-selected metric's resolved display value for a single campaign/ad-set slide — see report-data.ts's BuildReportDataInput.selectedMetrics (canonical home moved here since buildDynamicMetricSlides below is what produces it; report-data.ts re-exports this same type for its existing consumers). `type`/`perUnitOf` are carried through from SelectedMetric so the PPT render layer (dynamic-cards.ts) can pick the right accent color and icon without a second dictionary lookup. */
export interface DynamicMetricValue {
  key: string;
  label: string;
  format: SelectedMetric["format"];
  value: string;
  type: SelectedMetric["type"];
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
 * Sums currency/number metrics; averages non-zero values for
 * percentage/ratio/duration metrics — the same treatment the existing
 * fixed-field pipeline already gives CTR/CPC (a straight sum would be
 * meaningless for a rate or a per-unit average).
 *
 * Per-unit currency metrics (a "cost per X" / CPC / CPM-style average —
 * see SelectedMetric.perUnitOf) are a further special case: THESE must
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
  metrics: SelectedMetric[],
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

const CARDS_PER_SLIDE = 8;
const MIN_CARDS_ON_LAST_SLIDE = 4;

/**
 * Converts one campaign/ad-set's raw rows + the user's uncapped
 * selectedMetrics into one or more slides' worth of display-ready
 * DynamicMetricValue arrays (product fix: removing the old 8-metric
 * selection cap meant a campaign could now have more cards than fit on one
 * slide). Chunks selectedMetrics into groups of 8 in priority order —
 * slide 1 gets the first 8, slide 2 the next 8, and so on. If the LAST
 * chunk would render fewer than 4 cards, it's padded up to 4 by pulling
 * the next-highest-priority metrics from `paddingPool` that aren't already
 * selected (so a report never ends on a nearly-empty final slide) —
 * `paddingPool` is the account's full detected-metric candidate pool
 * (see metric-selector.ts's getAvailableMetrics called with no objective
 * filter), computed once by the caller and passed in unchanged for every
 * campaign/ad-set.
 *
 * A NaN aggregated value (see aggregateDynamicMetrics — a per-unit cost
 * metric with a zero denominator) renders as "—", never "$0.00"/"$NaN".
 */
export function buildDynamicMetricSlides<T extends RawMetricRow>(
  rawRows: T[],
  selectedMetrics: SelectedMetric[],
  paddingPool: SelectedMetric[],
  platform: "meta" | "google",
  currencySymbol: string,
): DynamicMetricValue[][] {
  if (selectedMetrics.length === 0) return [];

  const usedKeys = new Set(selectedMetrics.map((m) => m.key));
  const padCandidates = paddingPool.filter((m) => !usedKeys.has(m.key)).slice(0, MIN_CARDS_ON_LAST_SLIDE);

  const rawTotals = aggregateDynamicMetrics(rawRows, [...selectedMetrics, ...padCandidates], platform);
  const toValue = (m: SelectedMetric): DynamicMetricValue => {
    const raw = rawTotals[m.key];
    return {
      key: m.key,
      label: m.label,
      format: m.format,
      value: raw === undefined || Number.isNaN(raw) ? "—" : formatMetricValue(raw, m.format, currencySymbol),
      type: m.type,
      perUnitOf: m.perUnitOf,
    };
  };

  const chunks: SelectedMetric[][] = [];
  for (let i = 0; i < selectedMetrics.length; i += CARDS_PER_SLIDE) {
    chunks.push(selectedMetrics.slice(i, i + CARDS_PER_SLIDE));
  }
  if (chunks.length > 1) {
    const last = chunks[chunks.length - 1];
    if (last.length < MIN_CARDS_ON_LAST_SLIDE) {
      const need = MIN_CARDS_ON_LAST_SLIDE - last.length;
      last.push(...padCandidates.slice(0, need));
    }
  }

  return chunks.map((chunk) => chunk.map(toValue));
}
