/**
 * Automatic 8-slot metric-card assignment — the campaign template's 8 fixed
 * card positions (see fill-tags.ts's CARD_SLOT_TAGS) are filled entirely by
 * the engine by default, with no wizard step required. Slots 1-3 and 6 are
 * always the same four core metrics; slots 4, 5, 7, and 8 vary by the
 * campaign's own objective — detected via objective.ts's proven
 * getResultLabels()/getResultGroups() (already computed per campaign as
 * resultLabel/costLabel, unrelated to and untouched by this module), not
 * the old detect-objective.ts broad-key classifier.
 *
 * Slots 7/8 (Part 1, plus the redundancy fix below) are chosen by pickSlot,
 * which tries each case's own candidates in priority order and skips any
 * that duplicate an earlier slot in the same card set, are a redundant
 * superset of one (per REDUNDANT_WITH — e.g. CLICKS (ALL) once LINK CLICKS
 * is already shown), or have no real, non-zero data in this CSV — a few of
 * the product's literal per-objective picks would otherwise duplicate an
 * already-assigned slot for that specific case (e.g. Reach's own slot 4 is
 * already CPM; Purchases' own slot 7 is already ROAS) — those specific
 * cases substitute the next most relevant metric instead, documented
 * case-by-case below.
 *
 * A wizard-driven metric selection (Part 3's optional Metric Review step)
 * can override this automatic assignment entirely — see report-data.ts's
 * own use of `selectedMetrics` — in which case none of this module's
 * per-objective logic runs at all.
 *
 * Extra per-objective fields (link clicks, landing page views, video views,
 * CPM, etc. — anything beyond the 4 core metrics/results/cost-per-result
 * already computed elsewhere) are read directly from the campaign's raw CSV
 * rows via meta-dictionary.ts/google-dictionary.ts's own column mappings —
 * this module is the bridge between that comprehensive dictionary and the
 * template's fixed slot system, using dynamic-metrics.ts's
 * lookupMetricValue for the actual aggregation.
 */

import { findMetaMetricByKey } from "./meta-dictionary";
import { findGoogleMetricByKey } from "./google-dictionary";
import { lookupMetricValue, type DynamicMetricValue, type RawMetricRow } from "./dynamic-metrics";
import type { GoogleObjectiveKey } from "./detect-objective";
import type { SelectedMetric } from "./available-metrics";

/** Looks up `key` in the Meta dictionary and aggregates its value over `rawRows` — "—" if the key isn't in the dictionary, the CSV has no matching column, or the aggregated value is zero (per product spec: a slot's label always shows, but a zero/missing value shows a dash, never "0"). */
function metaSlotValue(rawRows: RawMetricRow[], key: string, currencySymbol: string): string {
  const entry = findMetaMetricByKey(key);
  if (!entry || !entry.format) return "—";
  return lookupMetricValue(rawRows, { key: entry.key, format: entry.format, csvName: entry.csvName, perUnitOf: entry.perUnitOf, perUnitScale: entry.perUnitScale }, "meta", currencySymbol);
}

function googleSlotValue(rawRows: RawMetricRow[], key: string, currencySymbol: string): string {
  const entry = findGoogleMetricByKey(key);
  if (!entry || !entry.format) return "—";
  return lookupMetricValue(rawRows, { key: entry.key, format: entry.format, csvName: entry.csvName, perUnitOf: entry.perUnitOf, perUnitScale: entry.perUnitScale }, "google", currencySymbol);
}

function slot(key: string, label: string, format: DynamicMetricValue["format"], value: string, perUnitOf?: string): DynamicMetricValue {
  return { key, label, format, value, perUnitOf };
}

/**
 * key -> keys that become redundant once this (more specific) key is
 * already selected for another slot in the same card set. CLICKS (ALL)
 * (every click type) is a strict superset of LINK CLICKS (just link
 * clicks) — a campaign whose LINK CLICKS card already shows real data
 * gets no extra information from also showing the broader, less specific
 * CLICKS (ALL) figure alongside it, and it invites the reader to compare
 * two numbers that are the same metric measured two different ways
 * (bug report: a Landing Page Views campaign showing both). VIDEO PLAYS
 * (any play, however brief) is likewise a superset of VIDEO VIEWS/
 * THRUPLAYS (a real, counted view) — included even though no case below
 * currently selects VIDEO PLAYS, so a future case can't reintroduce this
 * same redundant pair without this map already covering it.
 */
const REDUNDANT_WITH: Record<string, string[]> = {
  link_clicks: ["clicks_all"],
  video_views: ["video_plays"],
  thruplays: ["video_plays"],
};

type SlotCandidate = { key: string; label: string; format: DynamicMetricValue["format"] };

/**
 * Picks the first candidate (checked in the given priority order) that:
 * isn't already used by an earlier slot in this same card set, isn't made
 * redundant by one (per REDUNDANT_WITH — Issue 1), and actually has real,
 * non-zero data in this CSV (Issue 2 — `lookup()` already returns "—" for
 * a missing column or a zero aggregate, via dynamic-metrics.ts's
 * lookupMetricValue, so `!== "—"` is exactly "column exists AND value >
 * 0"). Once a candidate is used/redundant, it's dropped from consideration
 * entirely — even the final "nothing had real data" fallback (Part 1's
 * existing "always show the label, dash if no value" convention) only
 * ever falls back to the last non-redundant candidate, never back to a
 * duplicate/superset one just to avoid an empty slot.
 */
function pickSlot(candidates: SlotCandidate[], already: Set<string>, lookup: (key: string) => string): DynamicMetricValue {
  const isRedundant = (key: string) => [...already].some((usedKey) => REDUNDANT_WITH[usedKey]?.includes(key));
  const eligible = candidates.filter((c) => !already.has(c.key) && !isRedundant(c.key));
  // Every case below always lists at least one genuinely non-redundant
  // candidate for its own objective, so `eligible` is never empty in
  // practice — the full candidate list is only a defensive fallback
  // against a future case whose entire list happens to collide.
  const pool = eligible.length > 0 ? eligible : candidates;
  for (const c of pool) {
    const val = lookup(c.key);
    if (val !== "—") return slot(c.key, c.label, c.format, val);
  }
  const last = pool[pool.length - 1];
  return slot(last.key, last.label, last.format, "—");
}

function usedKeys(...slots: DynamicMetricValue[]): Set<string> {
  return new Set(slots.map((s) => s.key));
}

const CLICKS_ALL: SlotCandidate = { key: "clicks_all", label: "CLICKS (ALL)", format: "number" };
const LINK_CLICKS: SlotCandidate = { key: "link_clicks", label: "LINK CLICKS", format: "number" };
const COST_PER_LINK_CLICK: SlotCandidate = { key: "cpc_link_click", label: "COST PER LINK CLICK", format: "currency" };
const LANDING_PAGE_VIEWS: SlotCandidate = { key: "landing_page_views", label: "LANDING PAGE VIEWS", format: "number" };
const COST_PER_LPV: SlotCandidate = { key: "cost_per_lpv", label: "COST PER LPV", format: "currency" };

/**
 * Final safety net (explicit ask, Part 2): scans the already-built 8-slot
 * array for any pair where one key is a superset of another per
 * REDUNDANT_WITH. Every case in buildMetaSlots already avoids this via
 * pickSlot above (which substitutes the actual next-best candidate at
 * build time, when it still has access to that slot's own candidate
 * list) — this pass can't re-derive a substitute that late with no
 * candidate list of its own, so it can only blank the redundant slot's
 * value to "—" rather than ever display two cards for the same
 * underlying metric. In practice this never fires against the cases
 * below; it exists as a structural guarantee against a future case that
 * assigns a redundant key directly instead of through pickSlot.
 */
function dedupeSlots(slots: DynamicMetricValue[]): DynamicMetricValue[] {
  const keys = slots.map((s) => s.key);
  return slots.map((s, i) => {
    const isRedundant = keys.some((otherKey, j) => j !== i && REDUNDANT_WITH[otherKey]?.includes(s.key));
    return isRedundant ? { ...s, value: "—" } : s;
  });
}

/** The 4 always-the-same core inputs slots 1-3 and 6 are built from — already computed by report-data.ts's existing campaign/ad-set aggregation (fmtCurrency(spend) etc.), reused as-is rather than recomputed here. */
export interface MetaSlotBaseline {
  resultLabel: string;
  costLabel: string;
  spend: string;
  reach: string;
  impressions: string;
  ctr: string;
  /** Already-formatted result count/cost-per-result — objective.ts's getGroupedResultDisplay/getSingleRowResultDisplay output, reused directly for objectives whose slot 4/5 ARE the result/cost-per-result pair (e.g. Purchases, App Installs, Page Likes, Post Engagements, and the generic fallback). */
  resultValue: string;
  cprValue: string;
}

/**
 * Builds the 7-slot DynamicMetricValue array for one Meta campaign/ad-set,
 * per the product's literal objective → slot table. Slots 1-3 and 6 never
 * change; slots 4/5/(7) are chosen by matching `baseline.resultLabel`
 * against objective.ts's own OBJECTIVE_CATALOG vocabulary (case-
 * insensitive) — a few of the product's given case labels ("MESSAGING
 * CONVERSATIONS STARTED", "UNIQUE REACH", "MOBILE APP INSTALLS", "ENGAGEMENT")
 * don't literally appear in that vocabulary; they're kept as extra case
 * labels for fidelity to the spec, alongside the real equivalent label
 * objective.ts actually produces (e.g. "MESSAGING LEADS" for the messaging
 * branch) so the mapping fires correctly against real data.
 */
export function buildMetaSlots(baseline: MetaSlotBaseline, rawRows: RawMetricRow[], currencySymbol: string): DynamicMetricValue[] {
  const v = (key: string) => metaSlotValue(rawRows, key, currencySymbol);
  const resultLabel = (baseline.resultLabel || "").toUpperCase();

  let slot4: DynamicMetricValue;
  let slot5: DynamicMetricValue;
  let slot7: DynamicMetricValue;
  let slot8: DynamicMetricValue;

  switch (resultLabel) {
    case "WEBSITE LEADS":
    case "LEADS":
    case "META FORM LEADS":
      slot4 = slot("results", baseline.resultLabel, "number", baseline.resultValue);
      slot5 = slot("cost_per_result", baseline.costLabel, "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([LANDING_PAGE_VIEWS], usedKeys(slot4, slot5, slot7), v);
      break;

    case "LINK CLICKS":
      slot4 = slot("link_clicks", "LINK CLICKS", "number", v("link_clicks"));
      slot5 = slot("cpc_link_click", "COST PER CLICK", "currency", v("cpc_link_click"));
      slot7 = pickSlot([LANDING_PAGE_VIEWS], usedKeys(slot4, slot5), v);
      // Product spec's "Link Clicks/Traffic: LANDING PAGE VIEWS" would
      // duplicate this case's own slot 7, and CLICKS (ALL) would duplicate
      // slot 4's own LINK CLICKS (Issue 1) — COST PER LPV pairs naturally
      // with slot 7's own Landing Page Views count instead.
      slot8 = pickSlot([COST_PER_LPV, CLICKS_ALL], usedKeys(slot4, slot5, slot7), v);
      break;

    // Landing Page Views campaigns — Issue 1's reported bug: CLICKS (ALL)
    // used to sit alongside LINK CLICKS here, showing two cards for
    // (near enough) the same underlying metric. Spec: AD SPEND, REACH,
    // IMPRESSIONS, LANDING PAGE VIEWS, COST PER LPV, CTR, LINK CLICKS,
    // COST PER LINK CLICK — no CLICKS (ALL).
    case "LANDING PAGE VIEWS":
      slot4 = slot("landing_page_views", "LANDING PAGE VIEWS", "number", v("landing_page_views"));
      slot5 = slot("cost_per_lpv", "COST PER LPV", "currency", v("cost_per_lpv"));
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([COST_PER_LINK_CLICK], usedKeys(slot4, slot5, slot7), v);
      break;

    case "REACH":
    case "UNIQUE REACH":
      slot4 = slot("cpm", "CPM", "currency", v("cpm"));
      slot5 = slot("frequency", "FREQUENCY", "ratio", v("frequency"));
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      // Product spec's "Reach/Awareness: CPM" would duplicate this case's
      // own slot 4, and CLICKS (ALL) would duplicate slot 7's own LINK
      // CLICKS (Issue 1) — COST PER LINK CLICK pairs with it instead.
      slot8 = pickSlot([COST_PER_LINK_CLICK, CLICKS_ALL], usedKeys(slot4, slot5, slot7), v);
      break;

    case "VIDEO VIEWS":
    case "THRUPLAYS":
      slot4 = slot("video_views", "VIDEO VIEWS", "number", v("video_views"));
      slot5 = slot("cost_per_thruplay", "COST PER VIEW", "currency", v("cost_per_thruplay"));
      // REDUNDANT_WITH already blocks VIDEO PLAYS from ever following
      // either VIDEO VIEWS (slot 4) or THRUPLAYS (slot 7) here.
      slot7 = pickSlot([{ key: "thruplays", label: "THRUPLAYS", format: "number" }], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([{ key: "video_p100", label: "VIDEO AT 100%", format: "number" }], usedKeys(slot4, slot5, slot7), v);
      break;

    // "MESSAGING LEADS" is objective.ts's actual resultLabel for this
    // pattern (messaging conversations started) — kept alongside the
    // product's own given case labels for spec fidelity.
    case "MESSAGING LEADS":
    case "MESSAGING CONVERSATIONS STARTED":
    case "CONVERSATIONS":
      slot4 = slot("messaging_conversations_started", "CONVERSATIONS", "number", v("messaging_conversations_started"));
      slot5 = slot("cost_per_conversation", "COST PER CONV.", "currency", v("cost_per_conversation"));
      slot7 = pickSlot([{ key: "new_messaging_contacts", label: "NEW CONTACTS", format: "number" }], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([{ key: "messaging_contacts", label: "MESSAGING CONTACTS", format: "number" }], usedKeys(slot4, slot5, slot7), v);
      break;

    case "PURCHASES": {
      slot4 = slot("results", "PURCHASES", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER PURCHASE", "currency", baseline.cprValue);
      slot7 = pickSlot([{ key: "results_roas", label: "ROAS", format: "ratio" }], usedKeys(slot4, slot5), v);
      // Product spec: "prioritize ADD TO CART when available, then
      // INITIATE CHECKOUT, then ROAS" — ROAS is already this case's own
      // slot 7, so that final fallback tier is skipped in favor of the
      // default CLICKS (ALL) pick (not redundant here — LINK CLICKS isn't
      // used anywhere else in this case).
      slot8 = pickSlot(
        [
          { key: "add_to_cart", label: "ADD TO CART", format: "number" },
          { key: "initiate_checkout", label: "INITIATE CHECKOUT", format: "number" },
          CLICKS_ALL,
        ],
        usedKeys(slot4, slot5, slot7),
        v,
      );
      break;
    }

    case "APP INSTALLS":
    case "MOBILE APP INSTALLS":
      slot4 = slot("results", "APP INSTALLS", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER INSTALL", "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([{ key: "app_events", label: "APP EVENTS", format: "number" }], usedKeys(slot4, slot5, slot7), v);
      break;

    case "PAGE LIKES":
      slot4 = slot("results", "PAGE LIKES", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER LIKE", "currency", baseline.cprValue);
      slot7 = pickSlot([{ key: "post_engagements", label: "POST ENGAGEMENTS", format: "number" }], usedKeys(slot4, slot5), v);
      // Not redundant here — LINK CLICKS isn't used anywhere else in this case.
      slot8 = pickSlot([CLICKS_ALL], usedKeys(slot4, slot5, slot7), v);
      break;

    case "POST ENGAGEMENTS":
    case "ENGAGEMENT":
      slot4 = slot("results", "POST ENGAGEMENTS", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER ENGAGEMENT", "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      // CLICKS (ALL) would duplicate slot 7's own LINK CLICKS, and POST
      // ENGAGEMENTS would duplicate slot 4's own result (Issue 1) — POST
      // REACTIONS is the next most relevant engagement breakdown metric.
      slot8 = pickSlot([{ key: "post_reactions", label: "POST REACTIONS", format: "number" }], usedKeys(slot4, slot5, slot7), v);
      break;

    default:
      slot4 = slot("results", baseline.resultLabel || "RESULTS", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", baseline.costLabel || "COST PER RESULT", "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      // CLICKS (ALL) would duplicate slot 7's own LINK CLICKS (Issue 1).
      slot8 = pickSlot([LANDING_PAGE_VIEWS, COST_PER_LINK_CLICK], usedKeys(slot4, slot5, slot7), v);
  }

  return dedupeSlots([
    slot("spend", "AD SPEND", "currency", baseline.spend),
    slot("reach", "REACH", "number", baseline.reach),
    slot("impressions", "IMPRESSIONS", "number", baseline.impressions),
    slot4,
    slot5,
    slot("ctr", "CTR (ALL)", "percentage", baseline.ctr),
    slot7,
    slot8,
  ]);
}

/** Slots 1-3, 6, and 7 for a Google Ads campaign — the 5 core fields already formatted by google-report-data.ts's existing aggregation (slots 6-7 are truly fixed for Google, unlike Meta's slot 7, which every objective branch below reassigns). */
export interface GoogleSlotBaseline {
  spend: string;
  reach: string; // clicks, matching Google's own AD SPEND/CLICKS card relabeling
  impressions: string;
  ctr: string;
  cpc: string;
  results: string; // conversions, already formatted
  cpr: string; // cost per conversion, already formatted
}

/**
 * Google Ads counterpart of buildMetaSlots — slots 4/5 vary by the
 * account's own campaign type (see detect-objective.ts's
 * detectGoogleObjectiveKey, an account-wide column-presence classifier;
 * Google's pipeline has no per-campaign objective/type detection today, so
 * this applies the SAME classification to every campaign in the report,
 * matching how detectGoogleObjectiveKey already worked before this change).
 */
export function buildGoogleSlots(
  objectiveKey: GoogleObjectiveKey,
  baseline: GoogleSlotBaseline,
  rawRows: RawMetricRow[],
  currencySymbol: string,
): DynamicMetricValue[] {
  const v = (key: string) => googleSlotValue(rawRows, key, currencySymbol);

  let slot4: DynamicMetricValue;
  let slot5: DynamicMetricValue;
  let slot8: DynamicMetricValue;

  switch (objectiveKey) {
    case "shopping":
    case "performance_max":
      slot4 = slot("conv_value", "CONV. VALUE", "currency", v("conv_value"));
      slot5 = slot("roas", "ROAS", "ratio", v("roas"));
      // Product spec's "Shopping/PMax: ROAS" would duplicate this case's
      // own slot 5 — CONV. RATE is the next most relevant pick (conv_rate's
      // own dictionary entry already lists performance_max as an eligible
      // objective).
      slot8 = slot("conv_rate", "CONV. RATE", "percentage", v("conv_rate"));
      break;

    case "display":
      slot4 = slot("viewable_impr", "VIEWABLE IMPR.", "number", v("viewable_impr"));
      slot5 = slot("viewable_rate", "VIEWABLE RATE", "percentage", v("viewable_rate"));
      // Product spec's "Display: VIEWABLE RATE" would duplicate this case's
      // own slot 5 — VIEWABLE CPM is the next most relevant display metric.
      slot8 = slot("avg_viewable_cpm", "VIEWABLE CPM", "currency", v("avg_viewable_cpm"));
      break;

    case "video":
    case "youtube":
      slot4 = slot("video_views", "VIDEO VIEWS", "number", v("video_views"));
      slot5 = slot("avg_cpv", "AVG. CPV", "currency", v("avg_cpv"));
      slot8 = slot("video_p100", "VIDEO AT 100%", "number", v("video_p100"));
      break;

    case "search":
    default:
      slot4 = slot("conversions", "CONVERSIONS", "number", baseline.results);
      slot5 = slot("cost_per_conv", "COST PER CONV.", "currency", baseline.cpr);
      slot8 = slot("conv_rate", "CONV. RATE", "percentage", v("conv_rate"));
  }

  return [
    slot("spend", "AD SPEND", "currency", baseline.spend),
    slot("reach", "REACH", "number", baseline.reach),
    slot("impressions", "IMPRESSIONS", "number", baseline.impressions),
    slot4,
    slot5,
    slot("ctr", "CTR (ALL)", "percentage", baseline.ctr),
    slot("avg_cpc", "CPC (ALL)", "currency", baseline.cpc),
    slot8,
  ];
}

/**
 * Part 3/4 — builds slide cards from a wizard-supplied SelectedMetric[]
 * instead of the automatic per-objective assignment above (used whenever
 * report-data.ts/google-report-data.ts receive a `selectedMetrics` input).
 * `baseline` supplies the already-formatted values for the handful of keys
 * (spend/reach/impressions/ctr/results/cost_per_result/avg_cpc/...) the rest
 * of the report already computes through the existing fixed-field
 * aggregation — reused as-is here for consistency with the Combined Total
 * table/chart rather than re-derived from raw CSV rows. Any other selected
 * key (CSV-sourced, via the dictionary or Part 2's auto-catch) is aggregated
 * fresh from `rawRows` via dynamic-metrics.ts's lookupMetricValue, exactly
 * like the automatic assignment's own v()/metaSlotValue/googleSlotValue
 * helpers above.
 */
export function buildSlotsFromSelection(
  selected: SelectedMetric[],
  baseline: Partial<Record<string, string>>,
  rawRows: RawMetricRow[],
  platform: "meta" | "google",
  currencySymbol: string,
): DynamicMetricValue[] {
  return selected.map((metric) => {
    const baselineValue = baseline[metric.key];
    const value = baselineValue !== undefined ? baselineValue : lookupMetricValue(rawRows, metric, platform, currencySymbol);
    return { key: metric.key, label: metric.label, format: metric.format, value, perUnitOf: metric.perUnitOf };
  });
}
