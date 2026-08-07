/**
 * Google Ads campaign-type classifier — used by slot-assignment.ts's
 * buildGoogleSlots to decide the automatic 7-slot metric card assignment
 * (see its own doc comment). Header-presence based and account-wide:
 * Google's pipeline has no per-campaign type detection today, so the same
 * classification applies to every campaign in a given report.
 *
 * The Meta-side classifier that used to live in this file
 * (detectMetaObjectiveKey/detectCampaignObjectives, a broad-key system
 * feeding the old metric-selector.ts's priority-ranked selection) is gone —
 * Meta's own per-campaign objective now comes directly from objective.ts's
 * proven getResultLabels()/getResultGroups(), consumed straight by
 * slot-assignment.ts's buildMetaSlots. objective.ts itself is unrelated to
 * and untouched by this file.
 */

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

function normalizeHeaders(headers: string[]): string[] {
  return headers.filter(Boolean).map((h) => String(h).toLowerCase().trim());
}

export function detectGoogleObjectiveKey(headers: string[]): GoogleObjectiveKey {
  const h = normalizeHeaders(headers);
  const has = (...phrases: string[]) => phrases.some((p) => h.some((header) => header.includes(p)));

  if (has("store visits", "cost per store visit")) return "local";
  if (has("asset group", "listing group")) return "performance_max";
  if (has("orders", "conv. value / cost", "units sold", "avg. cart size", "gross profit")) return "shopping";
  if (has("trueview", "video played to", "avg. cpv")) return "video";
  if (has("engagements", "engagement rate", "avg. cpe")) return "demand_gen";
  if (has("viewable impr.", "viewable rate", "avg. viewable cpm")) return "display";
  if (has("avg. cost") && !has("avg. cpc")) return "app";
  if (has("lead revenue", "lead gross profit", "lead units sold")) return "leads";

  return "search";
}
