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
import { SECONDARY_FILL_KEYS, objectiveMetricKeys, type AvailableMetric, type SelectedMetric } from "./available-metrics";

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

const CLICKS_ALL: SlotCandidate = { key: "clicks_all", label: "CLICKS (ALL)", format: "number" };
const LINK_CLICKS: SlotCandidate = { key: "link_clicks", label: "LINK CLICKS", format: "number" };
const COST_PER_LINK_CLICK: SlotCandidate = { key: "cpc_link_click", label: "COST PER LINK CLICK", format: "currency" };
const LANDING_PAGE_VIEWS: SlotCandidate = { key: "landing_page_views", label: "LANDING PAGE VIEWS", format: "number" };
const COST_PER_LPV: SlotCandidate = { key: "cost_per_lpv", label: "COST PER LPV", format: "currency" };

/**
 * Product spec's mandatory global fallback chain for slots 7/8 (round I bug
 * fix): when a case's own objective-specific candidate(s) have no real data
 * in this CSV, these four are tried next, in this order, before the slot is
 * given up on entirely. Never assigned redundantly (REDUNDANT_WITH still
 * applies) and never assigned twice to the same card set.
 */
const FREQUENCY: SlotCandidate = { key: "frequency", label: "FREQUENCY", format: "ratio" };
const CPM: SlotCandidate = { key: "cpm", label: "CPM", format: "currency" };
const GLOBAL_FALLBACK_CHAIN: SlotCandidate[] = [LINK_CLICKS, CLICKS_ALL, FREQUENCY, CPM];

/**
 * Picks the first candidate (checked in the given priority order) that:
 * isn't already used by an earlier slot in this same card set, isn't made
 * redundant by one (per REDUNDANT_WITH — Issue 1), and actually has real,
 * non-zero data in this CSV (Issue 2 — `lookup()` already returns "—" for
 * a missing column or a zero aggregate, via dynamic-metrics.ts's
 * lookupMetricValue, so `!== "—"` is exactly "column exists AND value >
 * 0"). Once a candidate is used/redundant, it's dropped from consideration
 * entirely.
 *
 * Round I bug fix: previously, when nothing in `candidates` had real data,
 * this fell back to displaying the LAST candidate's own label with a dash
 * value — i.e. a metric NOT present in the uploaded CSV, shown by name with
 * no real number behind it. Per the product's non-negotiable rule ("never
 * assign a metric to a slot unless its column exists in the CSV AND its
 * aggregated value is non-zero"), this now instead tries the mandatory
 * global fallback chain (LINK CLICKS -> CLICKS (ALL) -> FREQUENCY -> CPM),
 * and if NONE of those have real data either, returns null — fill-tags.ts's
 * buildCampaignOrAdSetSlideXml already dashes out both the label and the
 * value for a null slot, so the slide shows a genuinely empty card rather
 * than a metric name the CSV doesn't actually support.
 */
function pickSlot(candidates: SlotCandidate[], already: Set<string>, lookup: (key: string) => string): DynamicMetricValue | null {
  const isRedundant = (key: string) => [...already].some((usedKey) => REDUNDANT_WITH[usedKey]?.includes(key));
  const isUsable = (c: SlotCandidate) => !already.has(c.key) && !isRedundant(c.key);

  for (const c of candidates.filter(isUsable)) {
    const val = lookup(c.key);
    if (val !== "—") return slot(c.key, c.label, c.format, val);
  }

  const alreadyTried = new Set(candidates.map((c) => c.key));
  for (const c of GLOBAL_FALLBACK_CHAIN.filter((c) => !alreadyTried.has(c.key) && isUsable(c))) {
    const val = lookup(c.key);
    if (val !== "—") return slot(c.key, c.label, c.format, val);
  }

  return null;
}

/**
 * Tries each candidate in order and returns the first with real, non-zero
 * CSV data — unlike pickSlot, never falls through to the global slot 7/8
 * fallback chain (LINK CLICKS/CLICKS (ALL)/FREQUENCY/CPM): this is used for
 * the "does a dedicated column exist for this metric at all" check, where
 * the caller supplies its own non-chain fallback (e.g. the campaign's
 * Results column) when nothing here has data.
 */
function firstAvailable(candidates: SlotCandidate[], lookup: (key: string) => string): DynamicMetricValue | null {
  for (const c of candidates) {
    const val = lookup(c.key);
    if (val !== "—") return slot(c.key, c.label, c.format, val);
  }
  return null;
}

function usedKeys(...slots: (DynamicMetricValue | null)[]): Set<string> {
  return new Set(slots.filter((s): s is DynamicMetricValue => s !== null).map((s) => s.key));
}

/**
 * Final safety net (explicit ask, Part 2): scans the already-built 8-slot
 * array for any pair where one key is a superset of another per
 * REDUNDANT_WITH. Every case in buildMetaSlots already avoids this via
 * pickSlot above (which substitutes the actual next-best candidate at
 * build time, when it still has access to that slot's own candidate
 * list) — this pass can't re-derive a substitute that late with no
 * candidate list of its own, so it blanks the redundant slot out entirely
 * (null, per Round I's "never show a slot the CSV doesn't genuinely back"
 * rule) rather than ever display two cards for the same underlying metric.
 * In practice this never fires against the cases below; it exists as a
 * structural guarantee against a future case that assigns a redundant key
 * directly instead of through pickSlot.
 */
function dedupeSlots(slots: (DynamicMetricValue | null)[]): (DynamicMetricValue | null)[] {
  const keys = slots.map((s) => s?.key);
  return slots.map((s, i) => {
    if (!s) return null;
    const isRedundant = keys.some((otherKey, j) => j !== i && otherKey && REDUNDANT_WITH[otherKey]?.includes(s.key));
    return isRedundant ? null : s;
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
export function buildMetaSlots(baseline: MetaSlotBaseline, rawRows: RawMetricRow[], currencySymbol: string): (DynamicMetricValue | null)[] {
  const v = (key: string) => metaSlotValue(rawRows, key, currencySymbol);
  const resultLabel = (baseline.resultLabel || "").toUpperCase();

  let slot4: DynamicMetricValue;
  let slot5: DynamicMetricValue;
  let slot7: DynamicMetricValue | null;
  let slot8: DynamicMetricValue | null;

  switch (resultLabel) {
    case "WEBSITE LEADS":
    case "LEADS":
      slot4 = slot("results", baseline.resultLabel, "number", baseline.resultValue);
      slot5 = slot("cost_per_result", baseline.costLabel, "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([LANDING_PAGE_VIEWS], usedKeys(slot4, slot5, slot7), v);
      break;

    // META FORM LEADS (on-Facebook lead forms, result_type "Leads (form)" /
    // "onsite_conversion.lead_grouped"): a dedicated "on-Facebook leads" /
    // "cost per on-facebook lead" / "cost per lead" column, when the CSV
    // actually has one, takes priority — otherwise the campaign's own
    // Results/Cost per result columns ARE the form-leads count/cost for
    // this objective, so they're reused directly (same mechanism as the
    // WEBSITE LEADS/LEADS case above), just always under the META FORM
    // LEADS/COST PER LEAD labels rather than whatever baseline.resultLabel/
    // costLabel happened to say.
    case "META FORM LEADS": {
      const dedicatedResult = firstAvailable([{ key: "meta_form_leads", label: "META FORM LEADS", format: "number" }], v);
      slot4 = dedicatedResult ?? slot("results", "META FORM LEADS", "number", baseline.resultValue);
      // "cost per lead" is tried second — some real InstantForms exports
      // use that literal header instead of "cost per on-facebook lead".
      const dedicatedCost = firstAvailable(
        [
          { key: "cost_per_meta_form_lead", label: "COST PER LEAD", format: "currency" },
          { key: "cost_per_lead", label: "COST PER LEAD", format: "currency" },
        ],
        v,
      );
      slot5 = dedicatedCost ?? slot("cost_per_result", "COST PER LEAD", "currency", baseline.cprValue);
      slot7 = pickSlot([LINK_CLICKS], usedKeys(slot4, slot5), v);
      // Meta Instant Form campaigns don't use landing pages (the lead is
      // captured on-Facebook), so LANDING PAGE VIEWS is irrelevant/
      // misleading for this objective. LINK CLICKS is the preferred slot
      // 8 pick, but it's already slot 7 above (pickSlot skips it as
      // already-used) — COST PER LINK CLICK is the fallback.
      slot8 = pickSlot([LINK_CLICKS, COST_PER_LINK_CLICK], usedKeys(slot4, slot5, slot7), v);
      // TEMP DEBUG — remove once the "meta_form_leads dashes" investigation
      // is done. Note: this whole buildMetaSlots() function only runs when
      // report-data.ts has no wizard/default selectedMetrics at all — most
      // report generations instead go through buildSlotsFromSelection +
      // redistributeCardSlots (see the SLOT ASSIGN DEBUG logs added there).
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) objective/resultLabel:", baseline.resultLabel);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) results raw value:", baseline.resultValue);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) spend raw value:", baseline.spend);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) cost per result raw:", baseline.cprValue);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) slot4:", slot4);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) slot5:", slot5);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) slot7:", slot7);
      console.log("SLOT ASSIGN DEBUG (buildMetaSlots) slot8:", slot8);
      break;
    }

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

    // Objective Confirmation (Part 6) — Purchases' own funnel steps (ADD TO
    // CART, then INITIATE CHECKOUT) take priority for slots 7/8 whenever
    // the CSV actually has real, non-zero data for either one; only when
    // NEITHER does the case fall back to ROAS + LANDING PAGE VIEWS instead.
    case "PURCHASES": {
      slot4 = slot("results", "PURCHASES", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER PURCHASE", "currency", baseline.cprValue);
      const hasFunnelData = v("add_to_cart") !== "—" || v("initiate_checkout") !== "—";
      if (hasFunnelData) {
        slot7 = pickSlot([{ key: "add_to_cart", label: "ADD TO CART", format: "number" }], usedKeys(slot4, slot5), v);
        slot8 = pickSlot(
          [{ key: "initiate_checkout", label: "INITIATE CHECKOUT", format: "number" }],
          usedKeys(slot4, slot5, slot7),
          v,
        );
      } else {
        slot7 = pickSlot([{ key: "results_roas", label: "ROAS", format: "ratio" }], usedKeys(slot4, slot5), v);
        slot8 = pickSlot([LANDING_PAGE_VIEWS], usedKeys(slot4, slot5, slot7), v);
      }
      break;
    }

    // Objective Confirmation (Part 6) — a campaign optimizing for Initiate
    // Checkout: slot 7 looks one funnel step earlier (ADD TO CART), slot 8
    // one step later (PURCHASES), showing where this campaign's traffic
    // actually converts further down the funnel.
    case "INITIATE CHECKOUT": {
      slot4 = slot("results", "INITIATE CHECKOUT", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER CHECKOUT", "currency", baseline.cprValue);
      slot7 = pickSlot([{ key: "add_to_cart", label: "ADD TO CART", format: "number" }], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([{ key: "purchases", label: "PURCHASES", format: "number" }], usedKeys(slot4, slot5, slot7), v);
      break;
    }

    // Objective Confirmation (Part 6) — a campaign optimizing for Add To
    // Cart: slot 7 looks one funnel step later (INITIATE CHECKOUT), slot 8
    // the full-funnel outcome (PURCHASES).
    case "ADD TO CART": {
      slot4 = slot("results", "ADD TO CART", "number", baseline.resultValue);
      slot5 = slot("cost_per_result", "COST PER ADD TO CART", "currency", baseline.cprValue);
      slot7 = pickSlot([{ key: "initiate_checkout", label: "INITIATE CHECKOUT", format: "number" }], usedKeys(slot4, slot5), v);
      slot8 = pickSlot([{ key: "purchases", label: "PURCHASES", format: "number" }], usedKeys(slot4, slot5, slot7), v);
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
): (DynamicMetricValue | null)[] {
  return selected.map((metric) => {
    const baselineValue = baseline[metric.key];
    const value = baselineValue !== undefined ? baselineValue : lookupMetricValue(rawRows, metric, platform, currencySymbol);
    // No real data for this metric on this specific campaign/ad set — null
    // flows through fill-tags.ts's existing null-slot handling (same path
    // the automatic buildMetaSlots/buildGoogleSlots assignment above already
    // uses), dashing out both the label and value rather than showing a
    // labeled card with just a "—" value.
    if (value === "—") return null;
    return { key: metric.key, label: metric.label, format: metric.format, value, perUnitOf: metric.perUnitOf };
  });
}

/**
 * A campaign/ad-set's own objective (its {resultLabel, costLabel} pair, the
 * same shape report-data.ts's campaignObjectiveMap already carries — see
 * buildCampaignObjectiveMap) narrowed down to the two SelectedMetric keys
 * objectiveMetricKeys derives from it, for use by
 * filterMetricsForCampaignObjective below.
 */
export interface CampaignObjectiveRef {
  resultLabel: string;
  costLabel: string;
}

// "results"/"cost_per_result" are the GENERIC keys a single-objective wizard
// selection (defaultMetaSelection, not the mixed-objective
// buildMultiObjectiveSelection) uses for a campaign's own primary metric —
// baseline (see computeMetaSlideMetrics) always resolves them to THIS
// campaign's own already-objective-aware value (getGroupedResultDisplayForObjective),
// so they're safe on every campaign regardless of objective and never
// collide with a mixed-objective selection's own synthetic per-objective
// keys (which are never literally "results"/"cost_per_result" — see
// buildMultiObjectiveSelection).
const ALWAYS_SHOW_BASE_KEYS = ["spend", "reach", "impressions", "ctr", "results", "cost_per_result"];

/**
 * Part 8 — a mixed-objective account's wizard selection (built once, account
 * -wide, by buildMultiObjectiveSelection) combines EVERY detected objective's
 * own result/cost pair into one list; that combined list is wrong to show
 * unfiltered on every campaign's own slide (a website_leads campaign has no
 * business showing another campaign's META FORM LEADS card). Filters down to
 * what's actually relevant to ONE campaign's own objective:
 *  - the 4 always-show base metrics (spend/reach/impressions/ctr)
 *  - every generic secondary in SECONDARY_FILL_KEYS (link clicks, LPV,
 *    frequency, CPC, video views, etc.) — relevant to every campaign
 *    regardless of its own objective
 *  - THIS campaign's own objective-specific result/cost pair, derived via
 *    objectiveMetricKeys (the same REACH-special-cased derivation
 *    buildMultiObjectiveSelection used to build the pair in the first place)
 * Every other objective's own result/cost pair is dropped — it was never in
 * one of the categories above, so it simply never matches. If fewer than
 * `minCount` metrics survive (an unusual objective mix that barely touches
 * the CSV's own generic secondaries), pads back up with the next
 * highest-priority dropped metrics, in their original selection order.
 */
export function filterMetricsForCampaignObjective(
  metrics: SelectedMetric[],
  campaignObjective: CampaignObjectiveRef | null,
  minCount = 4,
): SelectedMetric[] {
  const { resultKey, costKey } = campaignObjective ? objectiveMetricKeys(campaignObjective.resultLabel) : { resultKey: null, costKey: null };
  const allowKeys = new Set<string>([...ALWAYS_SHOW_BASE_KEYS, ...SECONDARY_FILL_KEYS]);

  const kept: SelectedMetric[] = [];
  const dropped: SelectedMetric[] = [];
  for (const metric of metrics) {
    if (allowKeys.has(metric.key) || metric.key === resultKey || metric.key === costKey) {
      kept.push(metric);
    } else {
      dropped.push(metric);
    }
  }

  if (kept.length < minCount) {
    kept.push(...dropped.slice(0, minCount - kept.length));
  }

  return kept;
}

/**
 * Part 4 — a client-facing slide should never show a card with "—" as its
 * value. buildSlotsFromSelection already nulls out a slot with no real data
 * for this specific campaign, which fill-tags.ts dashes out — but that
 * leaves a gap at that slot's own position. This compacts the real (non-
 * null) cards forward to fill the grid with no gaps and, if fewer than
 * `minCount` survive, pads back up with the next highest-priority
 * CSV-detected metric NOT already in this slide that also turns out to have
 * real, non-zero data for THIS campaign — checked for real here (unlike the
 * presence-only checks available back at wizard-selection time), by
 * resolving each candidate through the same baseline-then-raw-row lookup
 * buildSlotsFromSelection itself uses. Returns only the real (non-null)
 * cards, compacted — never longer than `maxCount`, and never padded with
 * trailing nulls beyond what actually has data (fill-tags.ts already treats
 * a short array's missing trailing indices exactly like an explicit null
 * slot, so there's no need to pad it back out).
 */
export function redistributeCardSlots(
  slots: (DynamicMetricValue | null)[],
  usedKeys: Set<string>,
  candidatePool: AvailableMetric[],
  baseline: Partial<Record<string, string>>,
  rawRows: RawMetricRow[],
  platform: "meta" | "google",
  currencySymbol: string,
  minCount = 4,
  maxCount = 8,
): DynamicMetricValue[] {
  const compacted = slots.filter((s): s is DynamicMetricValue => s !== null);
  // TEMP DEBUG — remove once the "meta_form_leads dashes" investigation is
  // done. Shows exactly which incoming slots were dropped (null, no real
  // data for this campaign) before any backfill runs.
  console.log(
    "SLOT ASSIGN DEBUG redistributeCardSlots — incoming slots (null = dashed/dropped):",
    slots.map((s) => (s ? { key: s.key, label: s.label, value: s.value } : null)),
  );
  console.log("SLOT ASSIGN DEBUG redistributeCardSlots — compacted count before backfill:", compacted.length, "minCount:", minCount);

  if (compacted.length < minCount) {
    const candidates = [...candidatePool].filter((m) => !usedKeys.has(m.key)).sort((a, b) => b.priority - a.priority);
    for (const candidate of candidates) {
      if (compacted.length >= minCount) break;
      usedKeys.add(candidate.key);
      const [resolved] = buildSlotsFromSelection([candidate], baseline, rawRows, platform, currencySymbol);
      if (resolved) {
        // TEMP DEBUG — remove once the "meta_form_leads dashes" investigation is done.
        console.log("SLOT ASSIGN DEBUG redistributeCardSlots — backfilled with:", { key: resolved.key, label: resolved.label, value: resolved.value });
        compacted.push(resolved);
      }
    }
  }

  return compacted.slice(0, maxCount);
}
