/**
 * Builds Meta Ads Manager column checklists from meta-dictionary.ts —
 * same source as Step 3 metric chips after upload.
 */

import { META_METRIC_DICTIONARY, type MetaMetricDefinition } from "./meta-dictionary";

const EXPORT_STRUCTURE_KEYS = ["campaign_name", "day", "result_type"] as const;

/** Always suggest these metric keys on export (plus structure columns). */
const EXPORT_ALWAYS_METRIC_KEYS = [
  "spend",
  "results",
  "cost_per_result",
  "reach",
  "impressions",
  "ctr",
  "link_clicks",
  "cpc_link_click",
] as const;

function scoreCsvNamePreference(csvName: string): number {
  let score = 100;
  const lower = csvName.toLowerCase();
  if (/\(usd\)|\(inr\)|\(gbp\)|\(eur\)|\(cad\)|\(aud\)/.test(lower)) score -= 40;
  if (lower === "amount spent") score += 15;
  if (lower.startsWith("amount spent (")) score -= 25;
  if (lower.length > 45) score -= 10;
  return score;
}

function pickBestEntryForKey(key: string): MetaMetricDefinition | undefined {
  const candidates = META_METRIC_DICTIONARY.filter(
    (e) => e.key === key && (e.type === "dimension" || e.type === "primary" || e.type === "secondary"),
  );
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, entry) =>
    scoreCsvNamePreference(entry.csvName) > scoreCsvNamePreference(best.csvName) ? entry : best,
  );
}

/** Labels close to Meta Ads Manager export headers (sentence case + acronyms). */
export function formatAdsManagerColumnLabel(csvName: string): string {
  const lower = csvName.toLowerCase().trim();
  const fixed: Record<string, string> = {
    "ctr (all)": "CTR (all)",
    "cpc (cost per link click)": "CPC (cost per link click)",
    "cpm (cost per 1,000 impressions)": "CPM (cost per 1,000 impressions)",
    "purchase roas (return on ad spend)": "Purchase ROAS (return on ad spend)",
    "result type": "Result type",
    "campaign name": "Campaign name",
    "amount spent": "Amount spent",
    "cost per result": "Cost per result",
    "link clicks": "Link clicks",
    "landing page views": "Landing page views",
    "add to cart": "Add to cart",
    "adds to cart": "Adds to cart",
  };
  if (fixed[lower]) return fixed[lower];

  let out = lower.charAt(0).toUpperCase() + lower.slice(1);
  out = out
    .replace(/\bctr\b/g, "CTR")
    .replace(/\bcpc\b/g, "CPC")
    .replace(/\bcpm\b/g, "CPM")
    .replace(/\broas\b/g, "ROAS");
  return out;
}

function columnLabelForKey(key: string): string | undefined {
  const entry = pickBestEntryForKey(key);
  return entry ? formatAdsManagerColumnLabel(entry.csvName) : undefined;
}

export function buildMetaExportBaseColumns(): string[] {
  const keys = [...EXPORT_STRUCTURE_KEYS, ...EXPORT_ALWAYS_METRIC_KEYS];
  const labels: string[] = [];
  for (const key of keys) {
    const label = columnLabelForKey(key);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export interface MetaCsvObjectivePickerSpec {
  id: string;
  label: string;
  /** Matches meta-dictionary `objectives` arrays on secondary metrics. */
  objectiveKeys: readonly string[];
  note?: string;
}

/** User-facing groups in the Import dropdown — map to dictionary objective tags. */
export const META_CSV_OBJECTIVE_PICKER_SPEC: readonly MetaCsvObjectivePickerSpec[] = [
  {
    id: "traffic_lpv",
    label: "Traffic · landing page views",
    objectiveKeys: ["traffic", "landing_page_views"],
  },
  {
    id: "link_clicks",
    label: "Traffic · link clicks",
    objectiveKeys: ["link_clicks"],
    note: "Base list already includes link clicks and CPC — add CTR (link) if you customize columns.",
  },
  {
    id: "leads",
    label: "Leads · forms & website",
    objectiveKeys: ["leads", "website_leads", "meta_form_leads"],
  },
  {
    id: "purchase",
    label: "Purchase & shopping funnel",
    objectiveKeys: ["sales"],
    note: "Include when you run purchase or catalog sales campaigns.",
  },
  {
    id: "reach",
    label: "Reach & awareness",
    objectiveKeys: ["reach", "awareness"],
  },
  {
    id: "messaging",
    label: "Messaging · WhatsApp / Instagram",
    objectiveKeys: ["messaging"],
  },
  {
    id: "video",
    label: "Video views",
    objectiveKeys: ["video_views"],
  },
  {
    id: "engagement",
    label: "Engagement",
    objectiveKeys: ["engagement"],
  },
  {
    id: "applications",
    label: "Applications & appointments",
    objectiveKeys: ["applications", "appointment_leads"],
  },
];

export function buildMetaExportExtraColumnsForObjectives(objectiveKeys: readonly string[]): string[] {
  const alwaysKeys = new Set<string>([...EXPORT_STRUCTURE_KEYS, ...EXPORT_ALWAYS_METRIC_KEYS]);
  const byKey = new Map<string, { priority: number; label: string }>();

  for (const entry of META_METRIC_DICTIONARY) {
    if (entry.type !== "secondary") continue;
    if (alwaysKeys.has(entry.key)) continue;
    const objs = entry.objectives;
    if (!objs?.length) continue;
    if (!objs.some((o) => objectiveKeys.includes(o))) continue;

    const label = formatAdsManagerColumnLabel(entry.csvName);
    const prev = byKey.get(entry.key);
    const priority = entry.priority ?? 0;
    if (!prev || priority > prev.priority) {
      byKey.set(entry.key, { priority, label });
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.priority - a.priority)
    .map((v) => v.label);
}

export interface MetaCsvObjectiveColumnGroup {
  id: string;
  label: string;
  columns: readonly string[];
  note?: string;
}

export function buildMetaCsvObjectiveColumnGroups(): MetaCsvObjectiveColumnGroup[] {
  return META_CSV_OBJECTIVE_PICKER_SPEC.map((spec) => ({
    id: spec.id,
    label: spec.label,
    note: spec.note,
    columns: buildMetaExportExtraColumnsForObjectives(spec.objectiveKeys),
  }));
}

export function metaCsvColumnsForObjectiveGroup(
  groupId: string,
  baseColumns: readonly string[],
  groups: readonly MetaCsvObjectiveColumnGroup[],
): string[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [...baseColumns];
  return [...baseColumns, ...group.columns];
}
