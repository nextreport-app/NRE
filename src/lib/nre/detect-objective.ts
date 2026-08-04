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

import { getResultGroups } from "./objective";
import { parseCellNum } from "./format";
import type { MetricRow } from "./types";

export type MetaObjectiveKey =
  | "awareness"
  | "reach"
  | "video_views"
  | "traffic"
  | "link_clicks"
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

  // Step 1 — the campaign's own majorityResultLabel (objective.ts's
  // getResultLabels/getResultGroups output, Step 1's own most-specific-
  // first result_type-text match). This is BY FAR the more reliable signal
  // when available (per-campaign, from real data) — checked as a single,
  // self-contained pass with NO header-presence fallback mixed in.
  //
  // Real bug this fixes (caught empirically, not hypothetically): the
  // header-presence fallback below used to be interleaved branch-by-branch
  // with these label checks, so e.g. a campaign whose OWN majorityResultLabel
  // was unambiguously "LINK CLICKS" still got classified as "leads" purely
  // because some OTHER campaign's "Website leads"/"Cost per lead" columns
  // happened to exist somewhere in the same shared CSV — exactly the
  // account-wide-guess failure mode Fix 6 (per-campaign detection) exists to
  // eliminate. A specific, real per-campaign signal must always win over a
  // generic account-wide column-presence guess.
  if (label === "WEBSITE LEADS") return "leads";
  if (label === "CALL LEADS") return "calls";
  if (["MESSAGING LEADS", "WHATSAPP LEADS", "INSTAGRAM DM LEADS"].includes(label)) return "messaging";
  if (label === "APP INSTALLS") return "app_promotion";
  if (label === "PURCHASES") return "sales";
  if (["META FORM LEADS", "LEADS"].includes(label)) return "leads";
  if (label === "VIDEO VIEWS") return "video_views";
  if (["POST ENGAGEMENTS", "PAGE LIKES", "FOLLOWERS", "EVENT RESPONSES"].includes(label)) return "engagement";
  if (label === "REACH") return "reach";
  if (label === "IMPRESSIONS") return "awareness";
  if (label === "LINK CLICKS" || label === "LANDING PAGE VIEWS") return "traffic";

  // Step 2 — no majorityResultLabel was given, or the campaign's own
  // result_type is genuinely blank/generic (e.g. a real Reach campaign,
  // which Meta typically doesn't populate a results count for at all) —
  // only THEN fall back to which objective-specific columns exist in the
  // shared account-wide CSV headers.
  // "website_leads" is part of the MetaObjectiveKey union per the product
  // spec, but meta-dictionary.ts's own website_leads/cost_per_lead entries
  // are tagged `objectives: ["leads"]`, not `["website_leads"]` — so
  // returning the finer-grained key here would make selectMetrics silently
  // fail to select them. Folded into the "leads" branch instead, which is
  // what the dictionary actually filters on.
  if (has("website leads", "cost per lead")) return "leads";
  if (has("phone calls placed", "call leads")) return "calls";
  if (has("messaging conversations started", "whatsapp conversations started")) return "messaging";
  if (has("app installs", "mobile app installs")) return "app_promotion";
  if (has("catalog sales")) return "catalog_sales";
  if (has("results roas", "purchase roas", "results value")) return "sales";
  if (has("meta leads", "leads")) return "leads";
  if (has("thruplays", "video plays", "video average play time")) return "video_views";
  if (has("post engagements", "page engagement", "facebook likes", "instagram follows")) return "engagement";
  if (has("link clicks", "landing page views")) return "traffic";

  return "traffic";
}

/**
 * Per-campaign objective detection for a Meta account whose CSV mixes
 * campaigns with genuinely different objectives (e.g. Reach + Traffic +
 * Lead Gen in the same export) — the header-presence fallback above only
 * sees the account's shared CSV columns, which can't tell campaigns apart,
 * so a single account-wide detectMetaObjectiveKey() call was always going
 * to pick one objective and misclassify every other campaign's secondary
 * metrics. This groups rows by campaign_name, reuses objective.ts's already
 * *-tested getResultGroups (the same "which result_type dominates this
 * campaign's rows" logic report-data.ts's own campaign slides call via
 * getGroupedResultDisplay) to get each campaign's majority result label —
 * Step 1's most reliable signal — then classifies each campaign
 * individually. Returns the deduped union across every campaign so
 * metric-selector.ts's selectMetrics can pre-suggest the union of every
 * objective's relevant secondaries (metrics unused by a particular
 * campaign's slide simply show "—", same as any other not-applicable
 * per-unit metric — see dynamic-metrics.ts).
 */
export function detectCampaignObjectives(rows: MetricRow[], headers: string[]): MetaObjectiveKey[] {
  const groups = new Map<string, MetricRow[]>();
  for (const row of rows) {
    const name = String(row.campaign_name || "").trim();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(row);
  }

  const seen = new Set<MetaObjectiveKey>();
  const result: MetaObjectiveKey[] = [];
  for (const campRows of groups.values()) {
    let majorityLabel = getResultGroups(campRows)[0]?.label ?? null;
    // A real Reach-objective campaign typically has a completely blank
    // result_type (Meta doesn't populate a results count for pure
    // awareness/reach campaigns at all), which getResultGroups can only
    // label generically as "RESULTS" — indistinguishable, by text alone,
    // from any other campaign whose result_type genuinely wasn't set. The
    // data VALUES still tell the story, the same way objective.ts's own
    // getResultGroups already special-cases REACH's cost-per-1K calculation
    // (see its doc comment): zero results across every row, but real reach,
    // is the distinguishing pattern of an actual Reach campaign.
    if (majorityLabel === "RESULTS") {
      const totalResults = campRows.reduce((sum, r) => sum + parseCellNum(r.results), 0);
      const totalReach = campRows.reduce((sum, r) => sum + parseCellNum(r.reach), 0);
      if (totalResults === 0 && totalReach > 0) majorityLabel = "REACH";
    }
    const key = detectMetaObjectiveKey(headers, majorityLabel);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
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
