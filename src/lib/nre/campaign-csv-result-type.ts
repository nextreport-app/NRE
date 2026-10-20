import type { MetricRow } from "./types";
import { normalizeCampaignName } from "./objective";
import { getMetaResultLabels } from "./meta-objective-dictionary";
import { normalizeObjectiveLabel, resolveObjectiveFromResultType } from "./result-type-map";

export interface CampaignCsvResultTypeSummary {
  /** Most common non-empty Result type cell for this campaign. */
  primary: string | null;
  /** Distinct non-empty Result type strings (sorted by frequency). */
  distinct: string[];
  /** Engine label implied by `primary`, when mappable. */
  expectedResultLabel: string | null;
}

function displayResultType(raw: string): string {
  return raw.trim();
}

/** Summarize Ads Reporting "Result type" column for one campaign's rows. */
export function summarizeCsvResultTypesForCampaign(rows: MetricRow[]): CampaignCsvResultTypeSummary {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rt = displayResultType(row.result_type ?? "");
    if (!rt) continue;
    counts.set(rt, (counts.get(rt) ?? 0) + 1);
  }
  if (counts.size === 0) {
    return { primary: null, distinct: [], expectedResultLabel: null };
  }
  const distinct = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([rt]) => rt);
  const primary = distinct[0] ?? null;
  return {
    primary,
    distinct,
    expectedResultLabel: primary ? expectedResultLabelFromCsvResultType(primary) : null,
  };
}

export function expectedResultLabelFromCsvResultType(resultType: string): string | null {
  const trimmed = resultType.trim();
  if (!trimmed) return null;
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
  if (!summary.primary || !summary.expectedResultLabel) return null;
  return normalizeObjectiveLabel(detectedResultLabel) === summary.expectedResultLabel;
}

export function buildCampaignCsvResultTypeMap(rows: MetricRow[]): Map<string, CampaignCsvResultTypeSummary> {
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
    out.set(name, summarizeCsvResultTypesForCampaign(campRows));
  }
  return out;
}
