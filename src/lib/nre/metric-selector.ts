/**
 * Smart metric selection engine — given the CSV columns actually detected
 * and the report's platform/objective(s), returns an ordered list of
 * metrics to pre-select for the Metric Preview wizard step (and,
 * ultimately, to render as PPT cards). Pure/synchronous — runs client-side
 * in the wizard, no DB or AI involved.
 *
 * Uncapped by design (product fix): earlier versions capped the auto-
 * selected set at 8 metrics, forcing users to choose which relevant
 * metrics to drop. Selection is now "include everything relevant" — the
 * PPT render layer (dynamic-cards.ts, via report-data.ts/
 * google-report-data.ts) is responsible for splitting a campaign whose
 * selectedMetrics exceeds 8 across multiple slides, not this module.
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
  /** See MetaMetricDefinition.perUnitOf — carried through so dynamic-metrics.ts can recompute per-unit cost metrics correctly instead of summing them. */
  perUnitOf?: string;
  /** See MetaMetricDefinition.perUnitScale. */
  perUnitScale?: number;
}

/**
 * The full candidate pool: every primary/secondary dictionary entry whose
 * csvName was actually detected in the CSV, sorted by priority descending
 * (see the module doc comment — Fix 1: a single combined ordering, not
 * "primaries block, then secondaries block", since several secondaries
 * outrank some primaries on priority and the display order is now driven
 * purely by priority).
 *
 * `detectedObjectives` filters SECONDARY entries only (primaries are always
 * included, regardless of objective) — omitted/empty means no objective
 * filtering at all, returning every detected primary/secondary metric
 * regardless of relevance. This "no filter" mode is what the wizard's
 * "Available but not included" pool and the PPT render layer's slide-
 * padding pool (see report-data.ts) both need: the full candidate universe,
 * not just what's objective-relevant.
 */
export function getAvailableMetrics(
  detectedColumns: string[],
  platform: "meta" | "google",
  detectedObjectives?: string | string[],
): SelectedMetric[] {
  const dictionary = platform === "google" ? GOOGLE_METRIC_DICTIONARY : META_METRIC_DICTIONARY;
  const normalizedColumns = new Set(detectedColumns.map((c) => c.trim().toLowerCase()));
  const objectiveSet =
    detectedObjectives && (Array.isArray(detectedObjectives) ? detectedObjectives.length > 0 : true)
      ? new Set(Array.isArray(detectedObjectives) ? detectedObjectives : [detectedObjectives])
      : null;

  const seenKeys = new Set<string>();
  const result: SelectedMetric[] = [];

  for (const entry of dictionary) {
    if (entry.type !== "primary" && entry.type !== "secondary") continue;
    if (!normalizedColumns.has(entry.csvName)) continue;
    if (!entry.label || !entry.format || entry.priority == null) continue;
    if (seenKeys.has(entry.key)) continue;

    if (entry.type === "secondary" && objectiveSet) {
      const objectives = entry.objectives ?? [];
      if (objectives.length > 0 && !objectives.some((o) => objectiveSet.has(o))) continue;
    }

    seenKeys.add(entry.key);
    result.push({
      key: entry.key,
      label: entry.label,
      format: entry.format,
      type: entry.type,
      priority: entry.priority,
      csvName: entry.csvName,
      perUnitOf: entry.perUnitOf,
      perUnitScale: entry.perUnitScale,
    });
  }

  result.sort((a, b) => b.priority - a.priority);
  return result;
}

/**
 * The wizard's auto-suggested default selection: every primary, plus every
 * secondary relevant to any of `detectedObjectives` (a single objective key,
 * or several — see detect-objective.ts's detectCampaignObjectives, which
 * detects one objective per campaign for a mixed-objective account and
 * unions them so, e.g., a Reach + Lead Gen account's suggestion covers both
 * campaigns' relevant metrics at once, not just whichever objective a
 * single account-wide heuristic happened to guess). No cap — see the module
 * doc comment.
 */
export function selectMetrics(
  detectedColumns: string[],
  platform: "meta" | "google",
  detectedObjectives: string | string[],
): SelectedMetric[] {
  return getAvailableMetrics(detectedColumns, platform, detectedObjectives);
}
