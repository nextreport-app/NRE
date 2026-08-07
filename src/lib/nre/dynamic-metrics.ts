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

/** One dynamically-selected metric's resolved display value for a single campaign/ad-set slide — see report-data.ts's BuildReportDataInput.selectedMetrics (canonical home moved here since buildDynamicMetricCards below is what produces it; report-data.ts re-exports this same type for its existing consumers). `type`/`perUnitOf` are carried through from SelectedMetric so the PPT render layer (dynamic-cards.ts) can pick the right accent color and icon without a second dictionary lookup. */
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
    if (CPC_METRIC_KEYS.has(metric.key)) {
      if (totalSpend === null) totalSpend = sumByKey(spendKey);
      result[metric.key] = aggregateCpc(rows, headerMap, totalSpend);
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
 * Converts one campaign/ad-set's raw rows + the wizard's 7-slot metric
 * assignment into that single slide's display-ready DynamicMetricValue
 * array, in the SAME slot order it was given — fill-tags.ts maps each
 * entry straight onto the campaign template's corresponding fixed card
 * slot (see its own CARD_SLOT_TAGS), so this never reorders, pads, or caps
 * its input; a campaign always gets exactly one slide with the template's
 * own 7 card positions, whatever metrics were assigned to them.
 *
 * A NaN aggregated value (see aggregateDynamicMetrics — a per-unit cost
 * metric with a zero denominator) renders as "—", never "$0.00"/"$NaN".
 */
export function buildDynamicMetricCards<T extends RawMetricRow>(
  rawRows: T[],
  selectedMetrics: SelectedMetric[],
  platform: "meta" | "google",
  currencySymbol: string,
): DynamicMetricValue[] {
  if (selectedMetrics.length === 0) return [];

  const rawTotals = aggregateDynamicMetrics(rawRows, selectedMetrics, platform);
  return selectedMetrics.map((m) => {
    const raw = rawTotals[m.key];
    return {
      key: m.key,
      label: m.label,
      format: m.format,
      value: raw === undefined || Number.isNaN(raw) ? "—" : formatMetricValue(raw, m.format, currencySymbol),
      type: m.type,
      perUnitOf: m.perUnitOf,
    };
  });
}
