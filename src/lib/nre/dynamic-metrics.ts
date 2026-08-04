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
import { parseCellNum } from "./format";

/** Any raw CSV row shape that still carries its original column values — both NreRow (Meta) and GoogleRow (Google) satisfy this. */
export interface RawMetricRow {
  _raw: Record<string, string>;
}

/**
 * Sums currency/number metrics; averages non-zero values for
 * percentage/ratio/duration metrics — the same treatment the existing
 * fixed-field pipeline already gives CTR/CPC (a straight sum would be
 * meaningless for a rate or a per-unit average).
 */
export function aggregateDynamicMetrics<T extends RawMetricRow>(rows: T[], metrics: SelectedMetric[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (rows.length === 0 || metrics.length === 0) return result;

  // Every row shares the same _raw header set (built from one shared CSV
  // header row in columns.ts), so resolving header casing/whitespace once
  // against the first row is safe and avoids re-resolving per row.
  const headerMap = new Map<string, string>();
  for (const header of Object.keys(rows[0]._raw || {})) {
    headerMap.set(header.trim().toLowerCase(), header);
  }

  for (const metric of metrics) {
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
