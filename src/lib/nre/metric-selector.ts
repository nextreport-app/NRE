/**
 * Smart metric selection engine — given the CSV columns actually detected
 * and the report's platform/objective, returns an ordered list of metrics
 * to pre-select for the Metric Preview wizard step (and, ultimately, to
 * render as PPT cards). Pure/synchronous — runs client-side in the wizard,
 * no DB or AI involved.
 */

import { META_METRIC_DICTIONARY } from "./meta-dictionary";
import { GOOGLE_METRIC_DICTIONARY } from "./google-dictionary";
import type { MetricFormat } from "./meta-dictionary";

export interface SelectedMetric {
  key: string;
  label: string;
  format: MetricFormat;
  type: "primary" | "secondary";
  priority: number;
  /** Original CSV column name to read the value from. */
  csvName: string;
}

/**
 * The full candidate pool: every primary/secondary dictionary entry whose
 * csvName was actually detected in the CSV, objective-filtered (secondary
 * only), sorted primaries-first-by-priority then secondaries-by-priority —
 * no `maxMetrics` cap. This is the wizard's "Available but not included"
 * pool (plus, sliced, the auto-selected default — see selectMetrics below).
 */
export function getAvailableMetrics(
  detectedColumns: string[],
  platform: "meta" | "google",
  detectedObjective: string,
): SelectedMetric[] {
  const dictionary = platform === "google" ? GOOGLE_METRIC_DICTIONARY : META_METRIC_DICTIONARY;
  const normalizedColumns = new Set(detectedColumns.map((c) => c.trim().toLowerCase()));

  const seenKeys = new Set<string>();
  const primaries: SelectedMetric[] = [];
  const secondaries: SelectedMetric[] = [];

  for (const entry of dictionary) {
    if (entry.type !== "primary" && entry.type !== "secondary") continue;
    if (!normalizedColumns.has(entry.csvName)) continue;
    if (!entry.label || !entry.format || entry.priority == null) continue;
    if (seenKeys.has(entry.key)) continue;

    if (entry.type === "secondary") {
      const objectives = entry.objectives ?? [];
      if (objectives.length > 0 && !objectives.includes(detectedObjective)) continue;
    }

    seenKeys.add(entry.key);
    const metric: SelectedMetric = {
      key: entry.key,
      label: entry.label,
      format: entry.format,
      type: entry.type,
      priority: entry.priority,
      csvName: entry.csvName,
    };
    (entry.type === "primary" ? primaries : secondaries).push(metric);
  }

  primaries.sort((a, b) => b.priority - a.priority);
  secondaries.sort((a, b) => b.priority - a.priority);
  return [...primaries, ...secondaries];
}

/**
 * 1. Look up each detected column in the platform's dictionary.
 * 2. Keep only 'primary'/'secondary' entries (dimension/metadata/never/
 *    unrecognized columns are never candidates).
 * 3. Filter secondary metrics to ones relevant to `detectedObjective` (an
 *    empty/omitted `objectives` list on the dictionary entry means "relevant
 *    to every objective").
 * 4. Sort by priority descending.
 * 5. Primary metrics are always included, in full, ahead of any secondary
 *    metric, regardless of `maxMetrics` — in practice neither dictionary
 *    has more than 8 primary entries, so this rarely if ever exceeds
 *    maxMetrics on its own.
 * 6. Secondary metrics fill any remaining slots up to `maxMetrics`.
 */
export function selectMetrics(
  detectedColumns: string[],
  platform: "meta" | "google",
  detectedObjective: string,
  maxMetrics: number = 8,
): SelectedMetric[] {
  const all = getAvailableMetrics(detectedColumns, platform, detectedObjective);
  const primaries = all.filter((m) => m.type === "primary");
  const secondaries = all.filter((m) => m.type === "secondary");
  const remainingSlots = Math.max(0, maxMetrics - primaries.length);
  return [...primaries, ...secondaries.slice(0, remainingSlots)];
}
