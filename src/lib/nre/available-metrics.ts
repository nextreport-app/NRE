/**
 * Part 2/3a — the CSV-driven metric pool behind the (optional) Metric
 * Review wizard step: every classifiable column in the uploaded CSV,
 * combined with the engine's own automatic 8-slot default selection (the
 * same one slot-assignment.ts computes when the wizard step is skipped),
 * so the wizard can pre-check "what the engine would have picked anyway"
 * and let the user swap any of it for something else it detected.
 *
 * Kept deliberately separate from slot-assignment.ts (which still owns the
 * REAL per-report/per-campaign automatic assignment used whenever no
 * wizard override is supplied): this module only needs to answer "what
 * metrics exist in this CSV, and what would the engine pick by default" —
 * a lightweight, values-free question (the wizard step runs before Dates,
 * so there's no finalized date-filtered data to aggregate real numbers
 * from yet — see report-upload-wizard.tsx's new step order). The default
 * selection here mirrors slot-assignment.ts's own per-objective slot 4/5/7/8
 * key choices; buildSlotAssignmentDefaultKeys.test.ts cross-checks the two
 * against each other so they can't silently drift apart.
 */

import { autoClassifyUnknownColumn as autoClassifyMeta, findMetaMetric, findMetaMetricByKey, type MetaMetricDefinition, type MetricFormat } from "./meta-dictionary";
import { autoClassifyUnknownColumn as autoClassifyGoogle, findGoogleMetric, findGoogleMetricByKey, type GoogleMetricDefinition } from "./google-dictionary";
import type { GoogleObjectiveKey } from "./detect-objective";

export type MetricPlatform = "META" | "GOOGLE";

/** A metric card's identity — enough to both aggregate its real value (dynamic-metrics.ts's MetricRef shape) and label a wizard card. This is the `SelectedMetric` shape carried through the wizard and the generate API. */
export interface SelectedMetric {
  key: string;
  label: string;
  format: MetricFormat;
  csvName: string;
  perUnitOf?: string;
  perUnitScale?: number;
}

export interface AvailableMetric extends SelectedMetric {
  priority: number;
  /** True for a column with no dictionary entry, classified on the fly by autoClassifyUnknownColumn (Part 2) — always priority 30, always excluded from the wizard's own dropdown (see listSelectableMetrics), but never silently dropped from this full pool. */
  isAutoCatch: boolean;
}

function toAvailableMetric(entry: MetaMetricDefinition | GoogleMetricDefinition, isAutoCatch: boolean): AvailableMetric | null {
  if (entry.type !== "primary" && entry.type !== "secondary") return null;
  if (!entry.label || !entry.format) return null;
  return {
    key: entry.key,
    label: entry.label,
    format: entry.format,
    csvName: entry.csvName,
    perUnitOf: entry.perUnitOf,
    perUnitScale: entry.perUnitScale,
    priority: entry.priority ?? 0,
    isAutoCatch,
  };
}

/**
 * Part 2 — every CSV column, looked up in the platform's dictionary; a miss
 * falls through to autoClassifyUnknownColumn rather than being dropped.
 * Deduplicated by key (first-seen wins) and sorted by priority descending —
 * the same "known metrics first, auto-caught ones last" order the wizard
 * dropdown wants.
 */
export function listAvailableMetrics(headers: string[], platform: MetricPlatform): AvailableMetric[] {
  const seen = new Set<string>();
  const out: AvailableMetric[] = [];
  for (const header of headers) {
    if (!header || !header.trim()) continue;
    const found = platform === "GOOGLE" ? findGoogleMetric(header) : findMetaMetric(header);
    const isAutoCatch = !found;
    const entry = found ?? (platform === "GOOGLE" ? autoClassifyGoogle(header) : autoClassifyMeta(header));
    if (!entry) continue;
    const metric = toAvailableMetric(entry, isAutoCatch);
    if (!metric || seen.has(metric.key)) continue;
    seen.add(metric.key);
    out.push(metric);
  }
  return out.sort((a, b) => b.priority - a.priority);
}

/**
 * Fix 1 — "results"/"cost_per_result" are the dictionary's own GENERIC
 * fallback keys ("RESULTS"/"COST PER RESULT"). defaultMetaSelection below
 * already substitutes the campaign's actual objective label for these same
 * underlying CSV columns (WEBSITE LEADS, META FORM LEADS, LINK CLICKS,
 * PURCHASES, etc.) when building the pre-selected default — so offering the
 * raw generic label as a SEPARATE, addable "Add a metric" option is always
 * redundant and reads as unclear next to the specific one already on the
 * slide. Excluded by key (not from listAvailableMetrics itself, which still
 * needs the full pool for Part 4's slide-2 padding and defaultMetaSelection's
 * own byKey lookups) so only the wizard's own addable dropdown is affected.
 */
const ALWAYS_EXCLUDED_SELECTABLE_KEYS = new Set(["results", "cost_per_result"]);

/** The wizard's own dropdown pool — real dictionary metrics only (Part 3's "not dimension/metadata/never/auto-catch items with priority < 50"; autoClassifyUnknownColumn's priority is always fixed at 30, so this cutoff always excludes every auto-caught column from the picker while still counting it in listAvailableMetrics above), minus the always-excluded generic RESULTS/COST PER RESULT keys (Fix 1). */
export function listSelectableMetrics(headers: string[], platform: MetricPlatform): AvailableMetric[] {
  return listAvailableMetrics(headers, platform).filter((m) => m.priority >= 50 && !ALWAYS_EXCLUDED_SELECTABLE_KEYS.has(m.key));
}

/** Part 4's per-campaign-slide cap — 1-8 selected metrics fit the template's own 8 card slots on one slide; 9-16 spill onto a second "Additional Metrics" slide. */
export const MAX_METRICS_PER_SLIDE = 8;
/** Part 4's hard ceiling — the wizard rejects a 17th selection outright ("Maximum 16 metrics (2 slides) per campaign."). */
export const MAX_TOTAL_METRICS = 16;
/** Part 4 — a second slide with fewer than this many metrics gets padded with the next highest-priority available (but unselected) metrics, so it never reads as a near-empty afterthought. */
export const MIN_SECOND_SLIDE_METRICS = 4;

/**
 * Part 4 — splits a wizard selection into one slide's worth of metrics (≤8,
 * the common case — returns a single-element array) or two (9-16 selected):
 * slide 1 gets the first 8 in the user's own order, slide 2 gets the rest,
 * padded up to MIN_SECOND_SLIDE_METRICS with the highest-priority metrics
 * from `available` that weren't already selected, if the remainder alone
 * would be fewer than that. Selections beyond MAX_TOTAL_METRICS are dropped
 * (the wizard itself is expected to block a 17th pick before this ever
 * runs, but this stays defensive rather than trusting that at the data
 * layer too).
 */
export function splitMetricsForSlides(selected: SelectedMetric[], available: AvailableMetric[]): SelectedMetric[][] {
  const capped = selected.slice(0, MAX_TOTAL_METRICS);
  if (capped.length <= MAX_METRICS_PER_SLIDE) return [capped];

  const slide1 = capped.slice(0, MAX_METRICS_PER_SLIDE);
  const slide2 = capped.slice(MAX_METRICS_PER_SLIDE);

  if (slide2.length < MIN_SECOND_SLIDE_METRICS) {
    const usedKeys = new Set(capped.map((m) => m.key));
    const padding = available.filter((m) => !usedKeys.has(m.key)).sort((a, b) => b.priority - a.priority);
    for (const candidate of padding) {
      if (slide2.length >= MIN_SECOND_SLIDE_METRICS) break;
      slide2.push(candidate);
      usedKeys.add(candidate.key);
    }
  }

  return [slide1, slide2];
}

function byKey(platform: MetricPlatform, key: string, labelOverride?: string, formatOverride?: MetricFormat): SelectedMetric | null {
  const entry = platform === "GOOGLE" ? findGoogleMetricByKey(key) : findMetaMetricByKey(key);
  if (!entry && !labelOverride) return null;
  return {
    key,
    label: labelOverride ?? entry?.label ?? key.toUpperCase(),
    format: formatOverride ?? entry?.format ?? "number",
    csvName: entry?.csvName ?? key,
    perUnitOf: entry?.perUnitOf,
    perUnitScale: entry?.perUnitScale,
  };
}

function hasHeader(headers: string[], ...csvNames: string[]) {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  return csvNames.some((name) => normalized.includes(name));
}

/**
 * The default 8 for a Meta report — mirrors slot-assignment.ts's
 * buildMetaSlots per-objective key choices exactly (same substitutions to
 * avoid a slot 4/5/7 duplicate; see that file's own comments for why), just
 * resolved to labels/formats via the dictionary instead of live aggregated
 * values, since no real numbers exist yet at this point in the wizard.
 */
export function defaultMetaSelection(resultLabel: string, resultCostLabel: string, headers: string[]): SelectedMetric[] {
  const upper = (resultLabel || "").toUpperCase();
  const core = [byKey("META", "spend")!, byKey("META", "reach")!, byKey("META", "impressions")!];
  const ctr = byKey("META", "ctr")!;
  const clicksAll = byKey("META", "clicks_all")!;
  const costPerLinkClick = byKey("META", "cpc_link_click", "COST PER LINK CLICK")!;

  let slot4: SelectedMetric;
  let slot5: SelectedMetric;
  let slot7: SelectedMetric;
  let slot8: SelectedMetric;

  switch (upper) {
    case "WEBSITE LEADS":
    case "LEADS":
      slot4 = byKey("META", "results", resultLabel)!;
      slot5 = byKey("META", "cost_per_result", resultCostLabel)!;
      slot7 = byKey("META", "link_clicks")!;
      slot8 = byKey("META", "landing_page_views")!;
      break;
    // META FORM LEADS — mirrors slot-assignment.ts's buildMetaSlots exactly:
    // a dedicated "on-Facebook leads"/"cost per on-facebook lead"/"cost per
    // lead" column takes priority when the CSV has one; otherwise the
    // Results/Cost per result columns are reused directly under the META
    // FORM LEADS/COST PER LEAD labels (they ARE the form-leads count/cost
    // for this objective).
    //
    // The no-dedicated-column fallback is classified under the
    // meta_form_leads/cost_per_meta_form_lead KEYS (not the generic
    // results/cost_per_result keys) so it reads as a pre-selected Metric
    // Cards card rather than a candidate in the "add a metric" pool
    // (listSelectableMetrics already excludes results/cost_per_result
    // universally — see ALWAYS_EXCLUDED_SELECTABLE_KEYS above). csvName
    // stays "results"/"cost per result" (spread from the byKey() call
    // before the key override) so a real aggregation still reads the
    // actual column that has the data, not the dedicated column's own
    // (absent) csvName.
    case "META FORM LEADS":
      slot4 = hasHeader(headers, "on-facebook leads")
        ? byKey("META", "meta_form_leads")!
        : { ...byKey("META", "results", "META FORM LEADS")!, key: "meta_form_leads" };
      if (hasHeader(headers, "cost per on-facebook lead")) {
        slot5 = byKey("META", "cost_per_meta_form_lead")!;
      } else if (hasHeader(headers, "cost per lead")) {
        slot5 = byKey("META", "cost_per_lead")!;
      } else {
        slot5 = { ...byKey("META", "cost_per_result", "COST PER LEAD")!, key: "cost_per_meta_form_lead" };
      }
      slot7 = byKey("META", "link_clicks")!;
      // Meta Instant Form campaigns don't use landing pages (the lead is
      // captured on-Facebook), so LANDING PAGE VIEWS is irrelevant/
      // misleading here. LINK CLICKS is the preferred slot 8 pick, but
      // it's already slot 7 above — COST PER LINK CLICK is the fallback.
      slot8 = costPerLinkClick;
      break;
    case "LINK CLICKS":
      slot4 = byKey("META", "link_clicks")!;
      slot5 = byKey("META", "cpc_link_click")!;
      slot7 = byKey("META", "landing_page_views")!;
      // CLICKS (ALL) would duplicate slot 4's own LINK CLICKS (Issue 1) —
      // COST PER LPV pairs with slot 7's own Landing Page Views instead.
      slot8 = byKey("META", "cost_per_lpv")!;
      break;
    // Landing Page Views — Issue 1's reported bug: CLICKS (ALL) used to sit
    // alongside LINK CLICKS here. Mirrors slot-assignment.ts's buildMetaSlots
    // fix exactly: LINK CLICKS + COST PER LINK CLICK, no CLICKS (ALL).
    case "LANDING PAGE VIEWS":
      slot4 = byKey("META", "landing_page_views")!;
      slot5 = byKey("META", "cost_per_lpv")!;
      slot7 = byKey("META", "link_clicks")!;
      slot8 = costPerLinkClick;
      break;
    case "REACH":
    case "UNIQUE REACH":
      slot4 = byKey("META", "cpm")!;
      slot5 = byKey("META", "frequency")!;
      slot7 = byKey("META", "link_clicks")!;
      // CLICKS (ALL) would duplicate slot 7's own LINK CLICKS (Issue 1).
      slot8 = costPerLinkClick;
      break;
    case "VIDEO VIEWS":
    case "THRUPLAYS":
      slot4 = byKey("META", "video_views")!;
      slot5 = byKey("META", "cost_per_thruplay")!;
      slot7 = byKey("META", "thruplays")!;
      slot8 = byKey("META", "video_p100")!;
      break;
    case "MESSAGING LEADS":
    case "MESSAGING CONVERSATIONS STARTED":
    case "CONVERSATIONS":
      slot4 = byKey("META", "messaging_conversations_started")!;
      slot5 = byKey("META", "cost_per_conversation")!;
      slot7 = byKey("META", "new_messaging_contacts")!;
      slot8 = byKey("META", "messaging_contacts")!;
      break;
    // Objective Confirmation (Part 6) — mirrors buildMetaSlots' own PURCHASES
    // case exactly: ADD TO CART/INITIATE CHECKOUT (this campaign's own
    // funnel steps) take priority for slots 7/8 whenever either header is
    // present; only when NEITHER is does the case fall back to ROAS +
    // LANDING PAGE VIEWS.
    case "PURCHASES": {
      slot4 = byKey("META", "results", "PURCHASES")!;
      slot5 = byKey("META", "cost_per_result", "COST PER PURCHASE")!;
      const hasAddToCart = hasHeader(headers, "adds to cart", "website adds to cart", "add to cart");
      const hasInitiateCheckout = hasHeader(headers, "initiate checkout");
      if (hasAddToCart || hasInitiateCheckout) {
        slot7 = hasAddToCart ? byKey("META", "add_to_cart")! : clicksAll;
        slot8 = hasInitiateCheckout ? byKey("META", "initiate_checkout")! : clicksAll;
      } else {
        // ROAS is always calculated from conversion value / spend (never
        // read off the CSV's own ROAS column) — so it only has real data
        // when a conversion-value column is present too, matching
        // buildMetaSlots' own pickSlot rejection of a dash-valued candidate.
        const hasConversionValue = hasHeader(headers, "purchases conversion value", "purchase conversion value", "conversion value", "results value");
        slot7 = hasConversionValue ? byKey("META", "results_roas")! : byKey("META", "link_clicks")!;
        slot8 = hasHeader(headers, "landing page views") ? byKey("META", "landing_page_views")! : clicksAll;
      }
      break;
    }
    case "APP INSTALLS":
    case "MOBILE APP INSTALLS":
      slot4 = byKey("META", "results", "APP INSTALLS")!;
      slot5 = byKey("META", "cost_per_result", "COST PER INSTALL")!;
      slot7 = byKey("META", "link_clicks")!;
      slot8 = byKey("META", "app_events")!;
      break;
    case "PAGE LIKES":
      slot4 = byKey("META", "results", "PAGE LIKES")!;
      slot5 = byKey("META", "cost_per_result", "COST PER LIKE")!;
      slot7 = byKey("META", "post_engagements")!;
      // Not redundant here — LINK CLICKS isn't used anywhere else in this case.
      slot8 = clicksAll;
      break;
    case "POST ENGAGEMENTS":
    case "ENGAGEMENT":
      slot4 = byKey("META", "results", "POST ENGAGEMENTS")!;
      slot5 = byKey("META", "cost_per_result", "COST PER ENGAGEMENT")!;
      slot7 = byKey("META", "link_clicks")!;
      // CLICKS (ALL) would duplicate slot 7's own LINK CLICKS, and POST
      // ENGAGEMENTS would duplicate slot 4's own result (Issue 1) — POST
      // REACTIONS is the next most relevant engagement breakdown metric.
      slot8 = byKey("META", "post_reactions")!;
      break;
    default:
      slot4 = byKey("META", "results", resultLabel || "RESULTS")!;
      slot5 = byKey("META", "cost_per_result", resultCostLabel || "COST PER RESULT")!;
      slot7 = byKey("META", "link_clicks")!;
      // CLICKS (ALL) would duplicate slot 7's own LINK CLICKS (Issue 1).
      slot8 = costPerLinkClick;
  }

  return [...core, slot4, slot5, ctr, slot7, slot8];
}

/** One detected objective's own {resultLabel, costLabel} text pair — see buildMultiObjectiveSelection below. Matches the shape of each entry in the /metrics route's own campaignObjectives map. */
export interface ObjectivePair {
  resultLabel: string;
  costLabel: string;
}

export function slugifyObjectiveKey(resultLabel: string): string {
  return resultLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Derives the {resultKey, costKey} pair buildMultiObjectiveSelection assigns
 * to a given objective's resultLabel. Three objectives have a REAL dedicated
 * dictionary metric standing in for "this objective's own result/cost" —
 * REACH/UNIQUE REACH (CPM/COST PER 1K REACHED, since Meta never populates a
 * real Results count for a genuine Reach objective — see
 * buildMultiObjectiveSelection's own doc comment), LINK CLICKS
 * (LINK CLICKS/COST PER CLICK), and VIDEO VIEWS/THRUPLAYS
 * (VIDEO VIEWS/COST PER VIEW) — `dedicated: true` for these means the keys
 * are real dictionary entries, not a renamed generic column, so a caller
 * must NOT redirect their value through the generic results/cost_per_result
 * baseline (see report-data.ts's computeMetaSlideMetrics). Every other
 * objective (META FORM LEADS, WEBSITE LEADS, PURCHASES, etc.) has no such
 * dedicated column — its own Results/Cost per result column IS its real
 * number — so it gets a synthetic key slugified from its own resultLabel
 * (`dedicated: false`). Exported so slot-assignment.ts's per-campaign slide
 * filter (filterMetricsForCampaignObjective) can derive the exact same keys
 * this function used to build the mixed-objective selection in the first
 * place — the two must never drift apart, or a campaign's own
 * objective-specific cards would silently fail to match back to themselves.
 */
export function objectiveMetricKeys(resultLabel: string): { resultKey: string; costKey: string; dedicated: boolean } {
  const upper = (resultLabel || "").toUpperCase();
  if (upper === "REACH" || upper === "UNIQUE REACH") {
    return { resultKey: "cpm", costKey: "cost_per_1k_reached", dedicated: true };
  }
  if (upper === "LINK CLICKS") {
    return { resultKey: "link_clicks", costKey: "cpc_link_click", dedicated: true };
  }
  if (upper === "VIDEO VIEWS" || upper === "THRUPLAYS") {
    return { resultKey: "video_views", costKey: "cost_per_thruplay", dedicated: true };
  }
  const key = slugifyObjectiveKey(resultLabel);
  return { resultKey: key, costKey: `cost_per_${key}`, dedicated: false };
}

/**
 * Part 2's fixed secondary-fill priority order (mixed-objective accounts):
 * tried in exactly this order after the mandatory per-objective pairs,
 * each only added when its own column is actually present in the CSV.
 * Exported so slot-assignment.ts's per-campaign slide filter can treat the
 * same set as "generic, relevant to every campaign regardless of objective".
 */
export const SECONDARY_FILL_KEYS = ["link_clicks", "cpc_all", "landing_page_views", "cost_per_lpv", "frequency", "clicks_all", "video_views", "thruplays"];

/**
 * Mixed-objective accounts — the account-wide counterpart to
 * defaultMetaSelection above, capped at exactly 8 metrics (one slide,
 * always) rather than trying to fit every detected objective's own pair in
 * at once. A second slide is no longer auto-generated here; it only ever
 * appears when the user consciously adds more than 8 metrics on the Metric
 * Cards screen (splitMetricsForSlides, unrelated to this function).
 *
 * Slots 1-3 + 6 are always AD SPEND/REACH/IMPRESSIONS/CTR. Slots 4-5 go to
 * ONE primary objective pair, chosen by priority — the first of these
 * actually detected across the account's campaigns wins:
 *   1. META FORM LEADS      4. LINK CLICKS
 *   2. WEBSITE LEADS/LEADS  5. VIDEO VIEWS/THRUPLAYS
 *   3. PURCHASES            6. REACH alone (no other objective detected)
 * Slots 7-8 go to secondary metrics: LINK CLICKS (unless already in 4-5)
 * and LANDING PAGE VIEWS, each only if its own column is present in the
 * CSV (no real aggregated values exist yet at this point in the wizard —
 * same presence-only limitation defaultMetaSelection's own hasHeader-based
 * cases already have).
 *
 * Two special cases override the plain priority pick:
 *  - META FORM LEADS + WEBSITE LEADS both detected: both get covered in one
 *    slide — slots 4-5 = META FORM LEADS/COST PER LEAD, slots 7-8 =
 *    WEBSITE LEADS/COST PER WEBSITE LEAD (instead of LINK CLICKS/LPV).
 *  - The chosen primary objective ALSO co-occurs with a REACH objective
 *    somewhere in the account: slot 7 = LINK CLICKS, slot 8 = CPM (the
 *    reach signal, as a secondary) instead of the plain LPV fill.
 *
 * Whichever objective wins slots 4-5, its own Results/Cost per result
 * column is reused directly (the same "the generic column IS this
 * objective's real number" principle defaultMetaSelection's own
 * per-objective cases use) UNLESS objectiveMetricKeys says it has a real
 * dedicated dictionary metric instead (REACH/LINK CLICKS/VIDEO VIEWS — see
 * that function's own doc comment).
 *
 * Everything NOT chosen for one of these 8 slots — every other detected
 * objective's own pair, CPM/COST PER 1K REACHED, FREQUENCY, COST PER LPV,
 * CPC, and so on — simply never enters this list, so it naturally shows up
 * in the wizard's "Available" section (listSelectableMetrics) instead,
 * exactly where a user who wants a second slide would go looking.
 */
export function buildMultiObjectiveSelection(objectivePairs: ObjectivePair[], headers: string[]): SelectedMetric[] {
  const core = [byKey("META", "spend")!, byKey("META", "reach")!, byKey("META", "impressions")!];
  const ctr = byKey("META", "ctr")!;
  const usedKeys = new Set<string>(["spend", "reach", "impressions", "ctr"]);

  // Distinct detected objective labels, first-seen order, each mapped to
  // the (possibly campaign-specific) costLabel text it was detected with.
  const distinctLabels: string[] = [];
  const costLabelByLabel = new Map<string, string>();
  for (const { resultLabel, costLabel } of objectivePairs) {
    const upper = (resultLabel || "").toUpperCase();
    if (!upper || costLabelByLabel.has(upper)) continue;
    distinctLabels.push(upper);
    costLabelByLabel.set(upper, costLabel);
  }
  const has = (label: string) => distinctLabels.includes(label);
  const hasReach = has("REACH") || has("UNIQUE REACH");

  function buildPair(label: string): { resultMetric: SelectedMetric; costMetric: SelectedMetric } {
    const { resultKey, costKey, dedicated } = objectiveMetricKeys(label);
    if (dedicated) {
      return { resultMetric: byKey("META", resultKey)!, costMetric: byKey("META", costKey)! };
    }
    const costLabel = costLabelByLabel.get(label) ?? `COST PER ${label}`;
    return {
      resultMetric: { ...byKey("META", "results", label)!, key: resultKey },
      costMetric: { ...byKey("META", "cost_per_result", costLabel)!, key: costKey },
    };
  }

  function addPair(metric: { resultMetric: SelectedMetric; costMetric: SelectedMetric }): [SelectedMetric, SelectedMetric] {
    usedKeys.add(metric.resultMetric.key);
    usedKeys.add(metric.costMetric.key);
    return [metric.resultMetric, metric.costMetric];
  }

  let slot4: SelectedMetric | null = null;
  let slot5: SelectedMetric | null = null;
  let slot7: SelectedMetric | null = null;
  let slot8: SelectedMetric | null = null;

  const hasMetaFormLeads = has("META FORM LEADS");
  const websiteLeadsLabel = has("WEBSITE LEADS") ? "WEBSITE LEADS" : has("LEADS") ? "LEADS" : null;

  if (hasMetaFormLeads && websiteLeadsLabel) {
    // Special case — both leads objectives detected: cover both in one slide.
    [slot4, slot5] = addPair(buildPair("META FORM LEADS"));
    [slot7, slot8] = addPair(buildPair(websiteLeadsLabel));
  } else {
    // Plain priority pick for slots 4-5.
    const primaryLabel =
      (hasMetaFormLeads && "META FORM LEADS") ||
      websiteLeadsLabel ||
      (has("PURCHASES") && "PURCHASES") ||
      (has("LINK CLICKS") && "LINK CLICKS") ||
      (has("VIDEO VIEWS") && "VIDEO VIEWS") ||
      (has("THRUPLAYS") && "THRUPLAYS") ||
      (hasReach && distinctLabels.every((l) => l === "REACH" || l === "UNIQUE REACH") && "REACH ONLY") ||
      distinctLabels[0] ||
      null;

    if (primaryLabel === "REACH ONLY") {
      [slot4, slot5] = addPair(buildPair("REACH"));
    } else if (primaryLabel) {
      [slot4, slot5] = addPair(buildPair(primaryLabel));
    }

    if (primaryLabel && primaryLabel !== "REACH ONLY" && hasReach) {
      // Special case — the chosen primary objective co-occurs with a REACH
      // objective elsewhere in the account: slot 8 carries the reach signal.
      const linkClicks = byKey("META", "link_clicks")!;
      if (!usedKeys.has(linkClicks.key)) {
        slot7 = linkClicks;
        usedKeys.add(linkClicks.key);
      }
      const cpm = byKey("META", "cpm")!;
      if (!usedKeys.has(cpm.key)) {
        slot8 = cpm;
        usedKeys.add(cpm.key);
      }
    } else {
      // Plain secondary fill — LINK CLICKS then LANDING PAGE VIEWS, each
      // only if its own column is present and not already used above.
      const linkClicks = byKey("META", "link_clicks")!;
      if (!usedKeys.has(linkClicks.key) && hasHeader(headers, linkClicks.csvName)) {
        slot7 = linkClicks;
        usedKeys.add(linkClicks.key);
      }
      const lpv = byKey("META", "landing_page_views")!;
      if (!usedKeys.has(lpv.key) && hasHeader(headers, lpv.csvName)) {
        slot8 = lpv;
        usedKeys.add(lpv.key);
      }
    }
  }

  return [core[0], core[1], core[2], slot4, slot5, ctr, slot7, slot8].filter((m): m is SelectedMetric => m !== null);
}

/** The default 8 for a Google report — mirrors slot-assignment.ts's buildGoogleSlots per-campaign-type key choices exactly. */
export function defaultGoogleSelection(objectiveKey: GoogleObjectiveKey): SelectedMetric[] {
  const core = [byKey("GOOGLE", "spend", "AD SPEND")!, byKey("GOOGLE", "reach", "REACH")!, byKey("GOOGLE", "impressions")!];
  const ctr = byKey("GOOGLE", "ctr", "CTR (ALL)")!;
  const avgCpc = byKey("GOOGLE", "avg_cpc", "CPC (ALL)")!;
  const convRate = byKey("GOOGLE", "conv_rate")!;

  let slot4: SelectedMetric;
  let slot5: SelectedMetric;
  let slot8: SelectedMetric;

  switch (objectiveKey) {
    case "shopping":
    case "performance_max":
      slot4 = byKey("GOOGLE", "conv_value")!;
      slot5 = byKey("GOOGLE", "roas")!;
      slot8 = convRate;
      break;
    case "display":
      slot4 = byKey("GOOGLE", "viewable_impr")!;
      slot5 = byKey("GOOGLE", "viewable_rate")!;
      slot8 = byKey("GOOGLE", "avg_viewable_cpm")!;
      break;
    case "video":
    case "youtube":
      slot4 = byKey("GOOGLE", "video_views")!;
      slot5 = byKey("GOOGLE", "avg_cpv")!;
      slot8 = byKey("GOOGLE", "video_p100", "VIDEO AT 100%")!;
      break;
    case "search":
    default:
      slot4 = byKey("GOOGLE", "conversions")!;
      slot5 = byKey("GOOGLE", "cost_per_conv")!;
      slot8 = convRate;
  }

  return [...core, slot4, slot5, ctr, avgCpc, slot8];
}
