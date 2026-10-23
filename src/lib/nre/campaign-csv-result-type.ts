import type { MetricRow } from "./types";
import { normalizeCampaignName } from "./objective";
import { getMetaResultLabels } from "./meta-objective-dictionary";
import {
  displayResultIndicatorLabel,
  normalizeMetaSyntheticResultType,
  syntheticResultTypeFromMetaResultIndicator,
  type MetaCustomConversionResultTypeLookup,
} from "./meta-result-indicator";
import { normalizeObjectiveLabel, resolveObjectiveFromResultType } from "./result-type-map";

export interface CsvResultTypeEntry {
  resultType: string;
  expectedResultLabel: string | null;
}

export interface CampaignCsvResultTypeSummary {
  /** Most common non-empty Result type cell for this campaign. */
  primary: string | null;
  /** Distinct non-empty Result type strings (sorted by frequency). */
  distinct: string[];
  /** Engine label implied by `primary`, when mappable. */
  expectedResultLabel: string | null;
  /** Every distinct Result type with its mapped objective (for multi-type campaigns). */
  entries: CsvResultTypeEntry[];
}

function displayResultType(raw: string, customConversionResultTypes?: MetaCustomConversionResultTypeLookup): string {
  return displayResultIndicatorLabel(raw, customConversionResultTypes);
}

/** Summarize Ads Reporting "Result type" column for one campaign's rows. */
export function summarizeCsvResultTypesForCampaign(
  rows: MetricRow[],
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): CampaignCsvResultTypeSummary {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = row._raw ?? {};
    const rt =
      (row.result_type ?? "").trim() ||
      String(raw["Result indicator"] ?? raw["result indicator"] ?? "").trim();
    if (!rt) continue;
    counts.set(rt, (counts.get(rt) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return { primary: null, distinct: [], expectedResultLabel: null, entries: [] };
  }
  const distinctRaw = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([rt]) => rt);
  const primaryRaw = distinctRaw[0] ?? null;
  const distinct = distinctRaw.map((rt) => displayResultType(rt, customConversionResultTypes));
  const primary = primaryRaw ? displayResultType(primaryRaw, customConversionResultTypes) : null;
  const entries = distinctRaw.map((rawType) => ({
    resultType: displayResultType(rawType, customConversionResultTypes),
    expectedResultLabel: expectedResultLabelFromCsvResultType(rawType, customConversionResultTypes),
  }));
  return {
    primary,
    distinct,
    expectedResultLabel: primaryRaw
      ? expectedResultLabelFromCsvResultType(primaryRaw, customConversionResultTypes)
      : null,
    entries,
  };
}

/** Distinct engine labels implied by all non-empty Result types in this campaign's CSV rows. */
export function expectedResultLabelsFromCsvSummary(summary: CampaignCsvResultTypeSummary): string[] {
  const labels = new Set<string>();
  for (const entry of summary.entries) {
    if (entry.expectedResultLabel) labels.add(normalizeObjectiveLabel(entry.expectedResultLabel));
  }
  return [...labels];
}

/** Meta Campaigns-table exports use Result indicator (actions:offsite_conversion…). */
function resultIndicatorObjectiveHint(
  resultType: string,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): string | null {
  const synthetic = syntheticResultTypeFromMetaResultIndicator(resultType, customConversionResultTypes);
  if (!synthetic) return null;
  const exact = resolveObjectiveFromResultType(synthetic);
  if (exact) return normalizeObjectiveLabel(exact.resultLabel);
  const fuzzy = getMetaResultLabels(synthetic);
  if (fuzzy.resultLabel !== "RESULTS") return normalizeObjectiveLabel(fuzzy.resultLabel);
  return null;
}

export function expectedResultLabelFromCsvResultType(
  resultType: string,
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): string | null {
  const trimmed = normalizeMetaSyntheticResultType(resultType.trim());
  if (!trimmed) return null;
  const fromIndicator = resultIndicatorObjectiveHint(trimmed, customConversionResultTypes);
  if (fromIndicator) return fromIndicator;
  const exact = resolveObjectiveFromResultType(trimmed);
  if (exact) return normalizeObjectiveLabel(exact.resultLabel);
  const fuzzy = getMetaResultLabels(trimmed);
  if (fuzzy.resultLabel !== "RESULTS") return normalizeObjectiveLabel(fuzzy.resultLabel);
  return null;
}

/** `true` = match, `false` = mismatch, `null` = nothing to compare (no CSV type or unknown text). */
export function csvResultTypeMatchesDetection(
  summary: CampaignCsvResultTypeSummary,
  detectedResultLabel: string,
): boolean | null {
  const expected = expectedResultLabelsFromCsvSummary(summary);
  if (expected.length === 0) return null;
  return expected.includes(normalizeObjectiveLabel(detectedResultLabel));
}

export function buildCampaignCsvResultTypeMap(
  rows: MetricRow[],
  customConversionResultTypes?: MetaCustomConversionResultTypeLookup,
): Map<string, CampaignCsvResultTypeSummary> {
  const byCampaign = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const key = normalizeCampaignName(row.campaign_name ?? "");
    if (!key) continue;
    const list = byCampaign.get(key) ?? [];
    list.push(row);
    byCampaign.set(key, list);
  }
  const out = new Map<string, CampaignCsvResultTypeSummary>();
  for (const [name, campRows] of byCampaign) {
    out.set(name, summarizeCsvResultTypesForCampaign(campRows, customConversionResultTypes));
  }
  return out;
}
