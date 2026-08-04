/**
 * Standardized objective-key classifier for the dynamic metric dictionary
 * system (meta-dictionary.ts / google-dictionary.ts / metric-selector.ts).
 *
 * This is deliberately a NEW, separate classifier from objective.ts's
 * OBJECTIVE_CATALOG / getResultLabels / getResultGroups, which stays
 * completely untouched — that system drives the health score and the
 * Combined Total table's per-row result-type labeling (both on the "don't
 * change" list) and outputs narrow, specific result labels like "WEBSITE
 * LEADS" or "PURCHASES". This classifier instead outputs one of a small set
 * of *broad* objective keys, used only by metric-selector.ts to decide which
 * SECONDARY dictionary metrics are relevant to pre-suggest — it has no
 * effect on any number shown anywhere in the report, and the wizard's
 * Metric Preview step always lets the user override the suggestion anyway.
 */

export type MetaObjectiveKey =
  | "awareness"
  | "reach"
  | "video_views"
  | "traffic"
  | "engagement"
  | "leads"
  | "website_leads"
  | "messaging"
  | "app_promotion"
  | "sales"
  | "catalog_sales"
  | "calls";

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

/**
 * `majorityResultLabel` — the resultLabel already computed by
 * objective.ts's getResultLabels/getResultGroups for the report's dominant
 * campaign objective, if the caller has it in scope. A stronger signal than
 * column presence alone when available, but entirely optional — column
 * presence alone is enough to classify most real CSVs.
 */
export function detectMetaObjectiveKey(headers: string[], majorityResultLabel: string | null = null): MetaObjectiveKey {
  const h = normalizeHeaders(headers);
  const has = (...phrases: string[]) => phrases.some((p) => h.some((header) => header.includes(p)));
  const label = (majorityResultLabel || "").toUpperCase();

  // "website_leads" is part of the MetaObjectiveKey union per the product
  // spec, but meta-dictionary.ts's own website_leads/cost_per_lead entries
  // are tagged `objectives: ["leads"]`, not `["website_leads"]` — so
  // returning the finer-grained key here would make selectMetrics silently
  // fail to select them. Folded into the "leads" branch instead, which is
  // what the dictionary actually filters on.
  if (label === "WEBSITE LEADS" || has("website leads")) return "leads";
  if (label === "CALL LEADS" || has("phone calls placed", "call leads")) return "calls";
  if (
    ["MESSAGING LEADS", "WHATSAPP LEADS", "INSTAGRAM DM LEADS"].includes(label) ||
    has("messaging conversations started", "whatsapp conversations started")
  )
    return "messaging";
  if (label === "APP INSTALLS" || has("app installs", "mobile app installs")) return "app_promotion";
  if (has("catalog sales")) return "catalog_sales";
  if (label === "PURCHASES" || has("results roas", "purchase roas", "results value")) return "sales";
  if (["META FORM LEADS", "LEADS"].includes(label) || has("meta leads", "leads")) return "leads";
  if (label === "VIDEO VIEWS" || has("thruplays", "video plays", "video average play time")) return "video_views";
  if (
    ["POST ENGAGEMENTS", "PAGE LIKES", "FOLLOWERS", "EVENT RESPONSES"].includes(label) ||
    has("post engagements", "page engagement", "facebook likes", "instagram follows")
  )
    return "engagement";
  if (label === "REACH") return "reach";
  if (label === "IMPRESSIONS") return "awareness";
  if (has("link clicks", "landing page views")) return "traffic";

  return "traffic";
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
