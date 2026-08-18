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
/**
 * (Step 6) Keys that are real dictionary secondary/primary entries — needed
 * elsewhere (e.g. slot-assignment.ts's REACH-objective card and its global
 * fallback chain both read "frequency" via the same dictionary entry) — but
 * must never surface as a selectable/available metric in the wizard's own
 * pool. Frequency is already shown on every campaign/ad-set slide (the "Ad
 * Frequency: X.Xx avg" line under the date range — see report-data.ts's
 * freqLine), so offering it again here would just duplicate that. Excluded
 * by key rather than by dictionary `type` so the dictionary entry itself
 * (and every other consumer of it) stays untouched.
 *
 * Fix 1 — "results"/"cost_per_result" are the dictionary's own GENERIC
 * fallback labels ("RESULTS"/"COST PER RESULT"). The wizard's default
 * selection (available-metrics.ts's defaultMetaSelection) already
 * substitutes the campaign's actual objective label for these same
 * underlying CSV columns (WEBSITE LEADS, META FORM LEADS, LINK CLICKS,
 * PURCHASES, etc.), so offering the raw generic label as a SEPARATE,
 * addable "Add a metric" option is always redundant and reads as unclear
 * next to the specific one already on the slide.
 */
const ALWAYS_EXCLUDED_KEYS = new Set(["frequency", "results", "cost_per_result"]);

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
    if (ALWAYS_EXCLUDED_KEYS.has(entry.key)) continue;
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
 *
 * META FORM LEADS fallback (mirrors slot-assignment.ts's buildMetaSlots):
 * for that objective, when the CSV has no dedicated "on-facebook leads"/
 * "cost per on-facebook lead"/"cost per lead" column (already surfaced by
 * getAvailableMetrics above, under key "meta_form_leads"/
 * "cost_per_meta_form_lead"/"cost_per_lead", whenever one of those columns
 * IS present), the campaign's own Results/Cost per result columns ARE the
 * form-leads count/cost for this objective — added here under the
 * meta_form_leads/cost_per_meta_form_lead keys and the META FORM LEADS/
 * COST PER LEAD labels (a pre-selected default), never the generic
 * results/cost_per_result keys getAvailableMetrics's own ALWAYS_EXCLUDED_KEYS
 * always drops from its addable pool.
 */
export function selectMetrics(
  detectedColumns: string[],
  platform: "meta" | "google",
  detectedObjectives: string | string[],
): SelectedMetric[] {
  const available = getAvailableMetrics(detectedColumns, platform, detectedObjectives);
  if (platform !== "meta") return available;

  const objectiveSet = new Set(Array.isArray(detectedObjectives) ? detectedObjectives : [detectedObjectives]);
  if (!objectiveSet.has("meta_form_leads")) return available;

  const normalizedColumns = new Set(detectedColumns.map((c) => c.trim().toLowerCase()));
  const hasDedicatedResult = available.some((m) => m.key === "meta_form_leads");
  const hasDedicatedCost = available.some((m) => m.key === "cost_per_meta_form_lead" || m.key === "cost_per_lead");

  const resultsEntry = META_METRIC_DICTIONARY.find((e) => e.key === "results" && e.csvName === "results");
  const cprEntry = META_METRIC_DICTIONARY.find((e) => e.key === "cost_per_result" && e.csvName === "cost per result");

  const fallback: SelectedMetric[] = [];
  if (!hasDedicatedResult && normalizedColumns.has("results") && resultsEntry?.format) {
    fallback.push({
      key: "meta_form_leads",
      label: "META FORM LEADS",
      format: resultsEntry.format,
      type: "primary",
      priority: resultsEntry.priority ?? 85,
      csvName: "results",
    });
  }
  if (!hasDedicatedCost && normalizedColumns.has("cost per result") && cprEntry?.format) {
    fallback.push({
      key: "cost_per_meta_form_lead",
      label: "COST PER LEAD",
      format: cprEntry.format,
      type: "primary",
      priority: cprEntry.priority ?? 80,
      csvName: "cost per result",
      perUnitOf: cprEntry.perUnitOf,
    });
  }

  return [...fallback, ...available].sort((a, b) => b.priority - a.priority);
}
