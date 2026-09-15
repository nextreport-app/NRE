/**
 * Universal Google Ads campaign-type dictionary — single source of truth for:
 *  - CSV header → campaign type detection (no result_type column in Google exports)
 *  - Per-campaign type in mixed exports (active-column scoring)
 *  - Slide result/cost labels (platform-reporting.ts)
 *  - Slot 4/5/8 metric assignment (slot-assignment.ts, available-metrics.ts)
 */

import { parseCellNum } from "./format";
import { findGoogleMetricByKey } from "./google-dictionary";
import type { RawMetricRow } from "./dynamic-metrics";

export type GoogleObjectiveKey =
  | "search"
  | "display"
  | "shopping"
  | "video"
  | "youtube"
  | "app"
  | "performance_max"
  | "demand_gen"
  | "local"
  | "leads";

export interface GoogleObjectiveSpec {
  key: GoogleObjectiveKey;
  /** Slide {{RESULT_LABEL}} — slot 4 heading. */
  resultLabel: string;
  /** Slide {{COST_LABEL}} — slot 5 heading. */
  costLabel: string;
  /** Substrings matched against normalized CSV headers (any hit = this type). */
  headerSignals: readonly string[];
  /** When set, matching any of these excludes this spec (e.g. app vs search avg. cost). */
  headerSignalsExclude?: readonly string[];
  /** Lower number = checked first (most specific types win). */
  detectionPriority: number;
  /** buildGoogleSlots / defaultGoogleSelection slot 4 dictionary key. */
  slot4MetricKey: string;
  slot5MetricKey: string;
  slot8MetricKey: string;
  slot8Label: string;
  /** googleCampaignResultDisplay primary metric (omit → conversions + CPL math). */
  primaryMetricKey?: string;
  secondaryMetricKey?: string;
}

const CONV_RATE = "conv_rate";

export const GOOGLE_OBJECTIVE_SPECS: readonly GoogleObjectiveSpec[] = [
  {
    key: "local",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    headerSignals: ["store visits", "cost per store visit"],
    detectionPriority: 10,
    slot4MetricKey: "conversions",
    slot5MetricKey: "cost_per_conv",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
  },
  {
    key: "performance_max",
    resultLabel: "CONV. VALUE",
    costLabel: "ROAS",
    headerSignals: ["asset group", "listing group"],
    detectionPriority: 20,
    slot4MetricKey: "conv_value",
    slot5MetricKey: "roas",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
    primaryMetricKey: "conv_value",
    secondaryMetricKey: "roas",
  },
  {
    key: "shopping",
    resultLabel: "CONV. VALUE",
    costLabel: "ROAS",
    headerSignals: ["orders", "conv. value / cost", "units sold", "avg. cart size", "gross profit"],
    detectionPriority: 30,
    slot4MetricKey: "conv_value",
    slot5MetricKey: "roas",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
    primaryMetricKey: "conv_value",
    secondaryMetricKey: "roas",
  },
  {
    key: "video",
    resultLabel: "VIDEO VIEWS",
    costLabel: "AVG. CPV",
    headerSignals: ["trueview", "video played to", "avg. cpv", "video views"],
    detectionPriority: 40,
    slot4MetricKey: "video_views",
    slot5MetricKey: "avg_cpv",
    slot8MetricKey: "video_p100",
    slot8Label: "VIDEO AT 100%",
    primaryMetricKey: "video_views",
    secondaryMetricKey: "avg_cpv",
  },
  {
    key: "youtube",
    resultLabel: "VIDEO VIEWS",
    costLabel: "AVG. CPV",
    headerSignals: ["youtube"],
    detectionPriority: 45,
    slot4MetricKey: "video_views",
    slot5MetricKey: "avg_cpv",
    slot8MetricKey: "video_p100",
    slot8Label: "VIDEO AT 100%",
    primaryMetricKey: "video_views",
    secondaryMetricKey: "avg_cpv",
  },
  {
    key: "demand_gen",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    headerSignals: ["engagements", "engagement rate", "avg. cpe"],
    detectionPriority: 50,
    slot4MetricKey: "conversions",
    slot5MetricKey: "cost_per_conv",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
  },
  {
    key: "display",
    resultLabel: "VIEWABLE IMPR.",
    costLabel: "VIEWABLE RATE",
    headerSignals: ["viewable impr.", "viewable rate", "avg. viewable cpm"],
    detectionPriority: 60,
    slot4MetricKey: "viewable_impr",
    slot5MetricKey: "viewable_rate",
    slot8MetricKey: "avg_viewable_cpm",
    slot8Label: "VIEWABLE CPM",
    primaryMetricKey: "viewable_impr",
    secondaryMetricKey: "viewable_rate",
  },
  {
    key: "app",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    headerSignals: ["avg. cost"],
    headerSignalsExclude: ["avg. cpc"],
    detectionPriority: 70,
    slot4MetricKey: "conversions",
    slot5MetricKey: "cost_per_conv",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
  },
  {
    key: "leads",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    headerSignals: ["lead revenue", "lead gross profit", "lead units sold"],
    detectionPriority: 80,
    slot4MetricKey: "conversions",
    slot5MetricKey: "cost_per_conv",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
  },
  {
    key: "search",
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    headerSignals: [],
    detectionPriority: 999,
    slot4MetricKey: "conversions",
    slot5MetricKey: "cost_per_conv",
    slot8MetricKey: CONV_RATE,
    slot8Label: "CONV. RATE",
  },
];

const specByKey = new Map<GoogleObjectiveKey, GoogleObjectiveSpec>(
  GOOGLE_OBJECTIVE_SPECS.map((s) => [s.key, s]),
);

export function googleObjectiveSpecForKey(key: GoogleObjectiveKey): GoogleObjectiveSpec {
  return specByKey.get(key) ?? specByKey.get("search")!;
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.filter(Boolean).map((h) => String(h).toLowerCase().trim());
}

function headersMatch(spec: GoogleObjectiveSpec, normalized: string[]): boolean {
  if (spec.headerSignals.length === 0) return false;
  const has = (...phrases: string[]) => phrases.some((p) => normalized.some((header) => header.includes(p)));
  if (!has(...spec.headerSignals)) return false;
  if (spec.headerSignalsExclude?.length) {
    if (has(...spec.headerSignalsExclude)) return false;
  }
  return true;
}

/** Detect campaign type from CSV headers — same priority order as legacy detect-objective.ts. */
export function detectGoogleObjectiveFromHeaders(headers: string[]): GoogleObjectiveSpec {
  const normalized = normalizeHeaders(headers);
  const sorted = [...GOOGLE_OBJECTIVE_SPECS].sort((a, b) => a.detectionPriority - b.detectionPriority);
  for (const spec of sorted) {
    if (spec.key === "search") continue;
    if (headersMatch(spec, normalized)) return spec;
  }
  return googleObjectiveSpecForKey("search");
}

export function detectGoogleObjectiveKey(headers: string[]): GoogleObjectiveKey {
  return detectGoogleObjectiveFromHeaders(headers).key;
}

/** Headers with at least one non-zero value in this campaign's raw rows. */
function activeHeadersForGoogleCampaign(rawRows: readonly RawMetricRow[]): string[] {
  if (rawRows.length === 0) return [];
  const allHeaders = Object.keys(rawRows[0]._raw || {});
  return allHeaders.filter((header) => rawRows.some((row) => parseCellNum(row._raw?.[header]) > 0));
}

function sumGoogleMetricKey(rawRows: readonly RawMetricRow[], metricKey: string): number {
  const def = findGoogleMetricByKey(metricKey);
  if (!def) return 0;
  const needle = def.csvName.toLowerCase();
  let sum = 0;
  for (const row of rawRows) {
    for (const [header, val] of Object.entries(row._raw || {})) {
      const h = header.toLowerCase().trim();
      if (h === needle || h.includes(needle)) sum += parseCellNum(val);
    }
  }
  return sum;
}

function scoreGoogleSpecForCampaign(rawRows: readonly RawMetricRow[], spec: GoogleObjectiveSpec): number {
  if (spec.primaryMetricKey) {
    const primary = sumGoogleMetricKey(rawRows, spec.primaryMetricKey);
    if (primary > 0) return primary;
  }
  if (spec.key === "search") {
    return sumGoogleMetricKey(rawRows, "conversions");
  }
  let score = 0;
  for (const signal of spec.headerSignals) {
    for (const row of rawRows) {
      for (const [header, val] of Object.entries(row._raw || {})) {
        if (header.toLowerCase().includes(signal)) score += parseCellNum(val);
      }
    }
  }
  return score;
}

/**
 * Per-campaign Google type — uses this campaign's own non-zero columns first,
 * then file-level headers for zero-activity campaigns. Mirrors Meta's
 * columnObjectiveForCampaign pattern for mixed exports.
 */
export function detectGoogleObjectiveFromCampaignRawRows(
  rawRows: readonly RawMetricRow[],
  fileHeaders: string[],
): GoogleObjectiveKey {
  const active = activeHeadersForGoogleCampaign(rawRows);
  const normalizedActive = normalizeHeaders(active.length > 0 ? active : fileHeaders);

  const sorted = [...GOOGLE_OBJECTIVE_SPECS].sort((a, b) => a.detectionPriority - b.detectionPriority);
  const matches = sorted.filter((spec) => spec.key !== "search" && headersMatch(spec, normalizedActive));

  if (matches.length === 1) return matches[0].key;

  if (matches.length > 1) {
    let best = matches[0];
    let bestScore = scoreGoogleSpecForCampaign(rawRows, best);
    for (const spec of matches.slice(1)) {
      const score = scoreGoogleSpecForCampaign(rawRows, spec);
      if (score > bestScore) {
        bestScore = score;
        best = spec;
      }
    }
    return best.key;
  }

  // Campaign has its own activity — classify from active columns only so
  // mixed-export file headers (e.g. Shopping "Orders" on a Search campaign)
  // cannot bleed across campaigns.
  return detectGoogleObjectiveKey(active.length > 0 ? active : fileHeaders);
}

/** One Google campaign type per campaign name — keys match campaignRawGroups. */
export function buildGoogleCampaignTypeMap(
  campaignRawGroups: Record<string, readonly RawMetricRow[]>,
  fileHeaders: string[],
): Map<string, GoogleObjectiveKey> {
  const map = new Map<string, GoogleObjectiveKey>();
  for (const [campaignName, rows] of Object.entries(campaignRawGroups)) {
    map.set(campaignName, detectGoogleObjectiveFromCampaignRawRows(rows, fileHeaders));
  }
  return map;
}
