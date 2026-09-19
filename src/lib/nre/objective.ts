/**
 * NRE v1 — result-type / objective label detection.
 * Direct port of getResultLabels_ / getResultGroups_ / getGroupedResultDisplay_ /
 * getSingleRowResultDisplay_ from meta_ads_report_v4.js, since substantially
 * extended (product owner, from real-account bug reports) into a 4-step
 * priority chain — see the comment above OBJECTIVE_CATALOG.
 */

import { hasRealRowDate } from "./columns";
import { parseCellNum, fmtNumber, fmtCurrency2dp } from "./format";
import { aggregateReach, aggregateReachAcrossCampaigns } from "./reach-aggregation";
import type { MetricRow } from "./types";
import type { AggRow } from "./aggregate";
import {
  getMetaCanonicalResultTypeText,
  getMetaResultLabels,
  resolveDefinitiveObjectiveFromRows,
  resolveUniqueMappedObjectiveFromRows,
} from "./meta-objective-dictionary";
import { MESSAGING_OBJECTIVE, resolveObjectiveFromResultType, type ObjectiveInfo } from "./result-type-map";
import {
  isLeadFamilyCampaignName,
  isMessagingCampaignName,
  isMetaFormLeadsCampaignName,
  isPurchaseCampaignName,
  isQuoteRequestCampaignName,
  isWebsiteLeadsCampaignName,
} from "./campaign-name-heuristics";

const { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL } = MESSAGING_OBJECTIVE;

export interface ResultLabels {
  resultLabel: string;
  costLabel: string;
}

/**
 * Step 1 of objective detection — delegates to meta-objective-dictionary.ts
 * (fuzzy catalog + exact alias fallback). See META_FUZZY_CATALOG there.
 */
export function getResultLabels(resultType: string | null | undefined): ResultLabels {
  return getMetaResultLabels(resultType);
}

/** Canonical round-trippable result_type text for aggregate.ts synthetic rows. */
export function canonicalResultTypeText(resultLabel: string): string {
  return getMetaCanonicalResultTypeText(resultLabel);
}

/**
 * Step 2 of objective detection — if result_type is empty, check which
 * objective-specific columns the CSV headers actually include, regardless
 * of whether they have values yet. Above data-value-based fallbacks (Step
 * 3, aggregate.ts) but below explicit result_type text (Step 1 above).
 *
 * Real-account bug this exists for: a brand new "Website Leads" campaign
 * with zero leads so far has an empty result_type and a zero-valued
 * "Website leads" column — but Meta always populates "Link clicks"
 * regardless of objective, so a value-based fallback wrongly detects
 * Clicks/Traffic. An agency only includes an objective-specific column in
 * their export when that's their actual campaign objective, so the column
 * merely EXISTING is a far more reliable signal than which columns happen
 * to be non-zero.
 *
 * Checked most-specific-first: "Website leads"/"Meta leads" before the
 * generic "leads" column check would otherwise catch them.
 */
export function detectObjectiveFromColumns(headers: (string | null | undefined)[]): ResultLabels | null {
  const normalized = headers.map((h) => (h || "").toLowerCase().trim());
  const has = (substr: string) => normalized.some((h) => h.includes(substr));

  if (has("website leads")) return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
  if (has("meta leads")) return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" };
  if (has("messaging conversations started")) return { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL };
  if (has("whatsapp conversations started"))
    return { resultLabel: "WHATSAPP LEADS", costLabel: "COST PER CONVERSATION" };
  if (has("phone calls") || has("calls")) return { resultLabel: "PHONE CALLS", costLabel: "COST PER CALL" };
  if (has("purchases")) return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };
  if (has("purchase roas")) return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };
  if (has("adds to cart") || has("add to cart"))
    return { resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART" };
  if (has("checkouts initiated")) return { resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT" };
  if (has("app installs")) return { resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL" };
  if (has("video plays") || has("thruplays"))
    return { resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW" };
  // Reached only once every more-specific column above is confirmed absent
  // (each of those checks already returned) — so this also satisfies "AND
  // Website leads column does NOT exist" etc. automatically.
  if (has("landing page views")) return { resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV" };
  if (has("leads")) return { resultLabel: "LEADS", costLabel: "COST PER LEAD" };
  return null;
}

/**
 * Per-campaign column detection for mixed-objective account exports.
 * File-level detectObjectiveFromColumns wrongly picks WEBSITE LEADS when
 * that column exists for another campaign — this sums each lead-family
 * column for one campaign's rows only.
 */
export function detectObjectiveFromCampaignRows(rows: MetricRow[]): ResultLabels | null {
  if (rows.length === 0) return null;

  let websiteLeadsTotal = 0;
  let metaLeadsTotal = 0;
  let messagingTotal = 0;
  for (const row of rows) {
    websiteLeadsTotal += parseCellNum(row.website_leads);
    metaLeadsTotal += parseCellNum(row.leads) + parseCellNum(row.meta_leads);
    const rt = (row.result_type || "").toLowerCase();
    if (/leads?\s*\(\s*form|lead_grouped|onsite_conversion\.lead|meta leads?/.test(rt)) {
      metaLeadsTotal += parseCellNum(row.results);
    }
    if (/website\s*submission|website leads?|web leads?|offsite_conversion.*lead|fb_pixel_lead/.test(rt)) {
      websiteLeadsTotal += parseCellNum(row.results);
    }
    messagingTotal += sumRawColumnByKeywords(row._raw, [
      "messaging conversations started",
      "whatsapp conversations started",
    ]);
  }

  const messagingCampaign = isMessagingCampaignName(rows);
  const websiteLeadsCampaign = isWebsiteLeadsCampaignName(rows);
  const metaFormLeadsCampaign = isMetaFormLeadsCampaignName(rows);

  const headers = Object.keys(rows[0]._raw || {});
  const hasHeader = (substr: string) => headers.some((h) => h.toLowerCase().includes(substr));

  const signals = [
    { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", value: websiteLeadsTotal },
    { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", value: metaLeadsTotal },
    { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL, value: messagingTotal },
  ].filter((s) => s.value > 0);

  if (signals.length >= 1) {
    if (hasQuoteRequestResultTypeRows(rows)) {
      return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE" };
    }
    if (messagingCampaign && messagingTotal > 0) {
      return { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL };
    }
    if (websiteLeadsCampaign && websiteLeadsTotal > 0) {
      return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
    }
    if (metaFormLeadsCampaign && metaLeadsTotal > 0) {
      return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" };
    }
    if (isQuoteRequestCampaignName(rows)) {
      return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE" };
    }
    // Mixed exports often carry one stray messaging count on website campaigns
    // (e.g. Lead Campaign_ Website_TOF) — name + traffic columns beat that noise.
    if (
      websiteLeadsCampaign &&
      messagingTotal > 0 &&
      websiteLeadsTotal === 0 &&
      (hasHeader("website leads") || isIncidentalMessagingForWebsiteCampaign(rows, messagingTotal))
    ) {
      return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
    }
    signals.sort((a, b) => b.value - a.value);
    return { resultLabel: signals[0].resultLabel, costLabel: signals[0].costLabel };
  }

  return detectObjectiveFromCampaignNameAndHeaders(rows);
}

/** Name + header hints when numeric columns are empty — per-campaign only, never file-wide. */
function detectObjectiveFromCampaignNameAndHeaders(rows: MetricRow[]): ResultLabels | null {
  if (rows.length === 0) return null;

  const headers = Object.keys(rows[0]._raw || {});
  const hasHeader = (substr: string) => headers.some((h) => h.toLowerCase().includes(substr));
  const messagingCampaign = isMessagingCampaignName(rows);
  const websiteLeadsCampaign = isWebsiteLeadsCampaignName(rows);
  const metaFormLeadsCampaign = isMetaFormLeadsCampaignName(rows);

  if (hasHeader("messaging conversations started") && messagingCampaign) {
    return { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL };
  }
  if (hasHeader("website leads") && websiteLeadsCampaign) {
    return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
  }
  if ((hasHeader("meta leads") || hasHeader("leads (form)")) && metaFormLeadsCampaign) {
    return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" };
  }
  if (isQuoteRequestCampaignName(rows)) {
    return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE" };
  }

  return null;
}

/** Headers with at least one non-zero value in this campaign's rows — avoids file-level column bleed. */
function activeHeadersForCampaign(rows: MetricRow[]): string[] {
  if (rows.length === 0) return [];
  const allHeaders = Object.keys(rows[0]._raw || {});
  return allHeaders.filter((header) => rows.some((row) => parseCellNum(row._raw?.[header]) > 0));
}

/**
 * Per-campaign Priority-3 column signal for resolveObjective / aggregateRows.
 * Uses this campaign's own numeric activity first, then name+header hints — never
 * the whole file's column list (which mislabels mixed-objective exports).
 */
export function columnObjectiveForCampaign(rows: MetricRow[]): ResultLabels | null {
  const purchaseNamed = purchaseObjectiveIfNamedCampaign(rows);
  if (purchaseNamed) return purchaseNamed;

  if (rows.some((r) => isWebsiteLeadsResultTypeText(r.result_type))) {
    return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
  }
  if (rows.some((r) => isQuoteRequestResultTypeText(r.result_type))) {
    return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE" };
  }

  const fromRows = detectObjectiveFromCampaignRows(rows);
  if (fromRows) return fromRows;

  const activeHeaders = activeHeadersForCampaign(rows);
  if (activeHeaders.length > 0) {
    const fromActive = detectObjectiveFromColumns(activeHeaders);
    if (fromActive) {
      if (TRAFFIC_ONLY_OBJECTIVE_LABELS.has(fromActive.resultLabel) && isLeadFamilyCampaignName(rows)) {
        const leadFromName = leadObjectiveFromCampaignNameOnly(rows);
        if (leadFromName) return leadFromName;
      } else {
        return fromActive;
      }
    }
  }

  const fromName = detectObjectiveFromCampaignNameAndHeaders(rows);
  if (fromName) return fromName;

  // Zero-activity campaigns (e.g. new Purchases campaign) — column exists in
  // the export but has no data yet. Lead-family headers are only trusted when
  // the campaign name agrees, so mixed-objective files cannot bleed across.
  const allHeaders = Object.keys(rows[0]._raw || {});
  const fromHeaders = detectObjectiveFromColumns(allHeaders);
  if (!fromHeaders) return null;

  const leadFamilyLabels = new Set([
    "WEBSITE LEADS",
    "META FORM LEADS",
    MESSAGING_LABEL,
    "WHATSAPP LEADS",
    "LEADS",
  ]);
  if (!leadFamilyLabels.has(fromHeaders.resultLabel)) {
    if (TRAFFIC_ONLY_OBJECTIVE_LABELS.has(fromHeaders.resultLabel) && isLeadFamilyCampaignName(rows)) {
      return leadObjectiveFromCampaignNameOnly(rows);
    }
    return fromHeaders;
  }
  if (fromHeaders.resultLabel === "WEBSITE LEADS" && isWebsiteLeadsCampaignName(rows)) return fromHeaders;
  if (fromHeaders.resultLabel === "META FORM LEADS" && isMetaFormLeadsCampaignName(rows)) return fromHeaders;
  if (
    (fromHeaders.resultLabel === MESSAGING_LABEL || fromHeaders.resultLabel === "WHATSAPP LEADS") &&
    isMessagingCampaignName(rows)
  ) {
    return fromHeaders;
  }

  return null;
}

/**
 * Numeric/text signals resolveObjective needs — a normalized subset of
 * either a raw NreRow (already-parsed numbers) or an aggregate.ts GroupAcc
 * accumulator. All fields optional/defaultable to 0 so a caller can pass
 * only what it has (e.g. an already-aggregated AggRow structurally lacks
 * website_leads/purchases/etc., so they're simply absent → treated as 0,
 * which correctly no-ops Priority 1 and falls straight through to Priority 2
 * on that row's own already-corrected result_type text).
 */
export interface ObjectiveSignals {
  result_type?: string | null;
  results?: number;
  reach?: number;
  purchases?: number;
  website_leads?: number;
  meta_leads?: number;
  leads?: number;
  landing_page_views?: number;
  link_clicks?: number;
  mobile_app_installs?: number;
  messaging_conversations_started?: number;
  thruplays?: number;
  /** Dedicated "Initiate checkout"/"Adds to cart" column values (Part 6 bug fix) — summed the same "exotic signal, no dedicated NreRow field" way as mobile_app_installs/messaging_conversations_started/thruplays above, via sumRawColumnByKeywords. See resolveObjective's purchases-vs-initiate-checkout ratio check below. */
  initiate_checkout?: number;
  add_to_cart?: number;
  /** The row's (or aggregate.ts group's) own ad_set_name — last-resort disambiguation signal, consulted only once every numeric/text/column signal above has come up empty for a blank result_type. */
  ad_set_name?: string | null;
}

/**
 * Which priority tier resolveObjective matched on — callers that write a
 * synthetic result_type back onto a row (aggregate.ts) need this to know
 * whether to preserve the row's own raw result_type text ("resultType", the
 * only tier that read real text rather than inferring a label) or write
 * canonicalResultTypeText(resultLabel) instead (every other tier, none of
 * which have real result_type text to preserve — either it was blank, or it
 * was blank/generic and got overridden by a stronger signal).
 */
export type ObjectiveSource = "priority1" | "resultType" | "priority3" | "priority4";

export interface ObjectiveResolution extends ResultLabels {
  source: ObjectiveSource;
}

/**
 * The unified objective-detection priority chain — shared by aggregate.ts's
 * aggregateRows (MTD/Weekly rows) and this file's own getResultGroups
 * (Period rows, and campaign/ad-set slide grouping). Fixes a real-account
 * bug report: a campaign with result_type = "landing_page_view" (an
 * intermediate signal Meta always populates) AND a non-zero "Website leads"
 * column (its actual, currently-optimized-for conversion) was showing
 * LANDING PAGE VIEWS instead of WEBSITE LEADS, because the old chain trusted
 * result_type text unconditionally, before ever looking at column values.
 *
 * Priority 1 — dedicated metric columns with an actual non-zero value: the
 * strongest signal there is, since it reflects real, current conversion
 * activity rather than a possibly-stale/intermediate result_type label or a
 * column that merely exists in the export with no data behind it yet.
 * Checked in the order specified by the bug fix (website leads > meta form
 * leads > purchases > app installs > messaging > video views). Link clicks
 * is deliberately NOT one of these checks — Meta always populates link
 * clicks regardless of objective, so a non-zero value alone is too weak a
 * signal on its own (unlike the objective-specific columns above, which an
 * agency only includes when that's their actual objective); the spec's
 * "link clicks column exists AND result_type shows link_click" condition is
 * exactly what Priority 2 below already does once result_type genuinely
 * says so, so it's handled there instead of duplicated here.
 *
 * Priority 2 — result_type text, trusted as-is once present (same as the
 * old Step 1) — this is what let LANDING PAGE VIEWS win before; now only
 * reached once Priority 1 has confirmed no stronger, more-current signal
 * exists.
 *
 * Priority 3 — column presence only, no value check (the old Step 2/
 * detectObjectiveFromColumns) — a brand new campaign with zero results yet
 * still gets its real objective from which column the agency's export
 * included, not a generic RESULTS bucket.
 *
 * Priority 4 — remaining data-value fallbacks in their original order (the
 * old Step 3's leftovers, now that website leads/leads/purchases moved up to
 * Priority 1: meta leads > landing page views > link clicks[gated by
 * reach !== results] > reach), then the generic RESULTS/COST PER RESULT
 * bucket as the absolute last resort.
 */
export function resolveObjective(
  signals: ObjectiveSignals,
  columnObjective: ResultLabels | null,
): ObjectiveResolution {
  const websiteLeads = signals.website_leads ?? 0;
  const leads = signals.leads ?? 0;
  const linkClicks = signals.link_clicks ?? 0;
  const purchases = signals.purchases ?? 0;
  const initiateCheckout = signals.initiate_checkout ?? 0;
  const addToCart = signals.add_to_cart ?? 0;
  const mobileAppInstalls = signals.mobile_app_installs ?? 0;
  const messaging = signals.messaging_conversations_started ?? 0;
  const thruplays = signals.thruplays ?? 0;
  const metaLeads = signals.meta_leads ?? 0;
  const landingPageViews = signals.landing_page_views ?? 0;
  const reach = signals.reach ?? 0;
  const results = signals.results ?? 0;

  if (websiteLeads > 0) {
    return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD", source: "priority1" };
  }
  if (leads > 0) {
    return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", source: "priority1" };
  }
  // Purchases vs Initiate Checkout vs Add To Cart (Part 7 bug fix, replacing
  // Part 6's "whichever count is larger" rule) — a raw column-count race
  // between these three is unreliable on its own: Initiate Checkout will
  // routinely out-count Purchases simply because a checkout has to start
  // before it can complete (normal funnel drop-off), not because the
  // campaign is actually optimizing for Initiate Checkout. Real-account bug
  // report: a genuine purchase campaign with sparse purchases but a bigger
  // Initiate Checkout column total (across mostly blank-result_type rows)
  // was misclassified as INITIATE CHECKOUT by the old "larger wins" rule.
  // Once more than one of the three is present, the tie-break instead
  // trusts the Results column — Meta's own declared primary conversion
  // metric for this row/group — and picks whichever of the three sums
  // closest to it. A single genuinely-alone nonzero signal always wins
  // outright with no comparison needed, preserving the original
  // single-signal behavior (Purchases alone -> PURCHASES, IC alone ->
  // INITIATE CHECKOUT, ATC alone -> ADD TO CART).
  // Purchase-optimized campaigns: real purchases beat mid-funnel columns; when
  // purchases are zero, ATC/IC are funnel tracking noise — not the objective.
  if (columnObjective?.resultLabel === "PURCHASES") {
    if (purchases > 0) {
      return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", source: "priority1" };
    }
    if (addToCart > 0 || initiateCheckout > 0) {
      return { ...columnObjective, source: "priority3" };
    }
  }

  const funnelCandidates = [
    { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", value: purchases },
    { resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", value: initiateCheckout },
    { resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", value: addToCart },
  ].filter((c) => c.value > 0);
  if (funnelCandidates.length > 0) {
    let best = funnelCandidates[0];
    let bestDiff = Math.abs(funnelCandidates[0].value - results);
    for (const c of funnelCandidates.slice(1)) {
      const diff = Math.abs(c.value - results);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    return { resultLabel: best.resultLabel, costLabel: best.costLabel, source: "priority1" };
  }
  if (mobileAppInstalls > 0) {
    return { resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL", source: "priority1" };
  }
  // Meta leads column (API sync) must beat incidental messaging counts — API
  // CSV always exports both columns; aggregateRows sums both and messaging
  // used to win here (GZ Australia Lead Forms → MESSAGING / CONVERSATIONS).
  if (metaLeads > 0) {
    return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", source: "priority1" };
  }
  const formLeadResultType =
    results > 0 &&
    /leads?\s*\(\s*form|lead_grouped|onsite_conversion\.lead|meta leads?/i.test(signals.result_type ?? "");
  if (formLeadResultType && messaging > 0) {
    return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", source: "priority1" };
  }
  if (messaging > 0) {
    return { resultLabel: MESSAGING_LABEL, costLabel: MESSAGING_COST_LABEL, source: "priority1" };
  }
  if (thruplays > 0) {
    return { resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", source: "priority1" };
  }

  const rt = getResultLabels(signals.result_type);
  if (rt.resultLabel !== "RESULTS") return { ...rt, source: "resultType" };

  if (columnObjective) return { ...columnObjective, source: "priority3" };

  // metaLeads handled above (priority1); keep for callers that omit it from signals.
  if (metaLeads > 0) return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD", source: "priority4" };
  if (landingPageViews > 0) {
    return { resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV", source: "priority4" };
  }
  if (linkClicks > 0 && reach !== results) {
    return { resultLabel: "LINK CLICKS", costLabel: "COST PER CLICK", source: "priority4" };
  }
  if (reach > 0) return { resultLabel: "REACH", costLabel: "COST PER 1K REACH", source: "priority4" };

  // Absolute last resort for a genuinely blank result_type with no
  // dedicated-column data at all: the ad set's own name often still names
  // its funnel stage (e.g. "ATC Retargeting", "Purchase - Broad") even when
  // Meta's own numeric columns don't have anything yet. Weaker evidence
  // than any real data value above, so this only ever runs once every one
  // of those has already come up empty.
  const adSetName = (signals.ad_set_name || "").toLowerCase();
  if (adSetName) {
    if (/\batc\b/.test(adSetName)) {
      return { resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", source: "priority4" };
    }
    if (/\bic\b|initiate/.test(adSetName)) {
      return { resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", source: "priority4" };
    }
    if (/purchase|conversion/.test(adSetName)) {
      return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", source: "priority4" };
    }
  }

  return { resultLabel: "RESULTS", costLabel: "COST PER RESULT", source: "priority4" };
}

export interface ResultGroup {
  label: string;
  costLabel: string;
  count: number;
  avgCpr: number;
  /** This objective's own campaigns' spend total — never the account's combined spend across every objective. Exposed for callers (e.g. report-data.ts's Combined Total table) that need to rank objectives by spend or distinguish "spend but zero results" from "no activity at all", neither of which avgCpr alone can answer (it's 0 in both cases). */
  totalSpend: number;
}

interface ObjectiveBucket {
  costLabel: string;
  count: number;
  totalSpend: number;
  totalReach: number;
  rows?: MetricRow[];
}

/** Shared tail of getResultGroups/groupResultsByCampaignObjective: turns accumulated per-label buckets into sorted ResultGroup[], computing REACH's cost-per-1K special case (see getResultGroups' doc comment). */
function buildResultGroups(groups: Record<string, ObjectiveBucket>): ResultGroup[] {
  return Object.entries(groups)
    .map(([label, g]) => {
      let adjCpr: number;
      if (label === "REACH" && g.count === 0) {
        adjCpr = g.totalReach > 0 ? (g.totalSpend * 1000) / g.totalReach : 0;
      } else {
        const rawCpr = g.count > 0 ? g.totalSpend / g.count : 0;
        adjCpr = label === "REACH" ? rawCpr * 1000 : rawCpr;
      }
      return { label, costLabel: g.costLabel, count: g.count, avgCpr: adjCpr, totalSpend: g.totalSpend };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Sums a row's raw CSV column value(s) whose header text contains any of the
 * given keywords — for the "exotic" ObjectiveSignals that have no dedicated
 * mapped field on NreRow/MetricRow (mobile app installs, messaging
 * conversations started, thruplays, and now initiate_checkout/add_to_cart),
 * mirroring detectObjectiveFromColumns' own substring-match approach but
 * reading values instead of just presence. Shared by aggregate.ts (per
 * accumulated ad-set group) and getResultGroups below (per raw row, e.g. the
 * Objective Confirmation wizard step's own pre-selection, which runs on
 * unaggregated CSV rows before aggregateRows ever sees them).
 */
export function sumRawColumnByKeywords(raw: Record<string, string> | undefined, keywords: string[]): number {
  if (!raw) return 0;
  let total = 0;
  for (const [header, value] of Object.entries(raw)) {
    const h = header.toLowerCase();
    if (keywords.some((k) => h.includes(k))) total += parseCellNum(value);
  }
  return total;
}

/**
 * Port of getResultGroups_ — groups rows by detected result label, totals
 * count + spend, and computes avgCpr (REACH is cost-per-1K, so ×1000).
 *
 * Fix vs the source snapshot read from Drive (per product owner, applied
 * upstream in the latest Apps Script): a REACH group's avgCpr used to be
 * derived from the `results` column count, which is typically 0 for a real
 * Reach objective (Meta doesn't populate a results metric for pure
 * awareness campaigns) — so the campaign slide would show a dash instead of
 * a real cost figure. When a REACH group has no results, cost-per-1K-reach
 * is computed directly from the reach column instead.
 *
 * Row-level grouping: each ROW gets its own resolveObjective call, so a
 * mixed set of rows (e.g. every ad set across an entire account) can produce
 * a group for every distinct signal present anywhere in that set — exactly
 * right for a single campaign's own rows (getGroupedResultDisplay), but see
 * buildCampaignObjectiveMap/groupResultsByCampaignObjective below for why
 * that's the wrong granularity for the Combined Total table.
 */
export function getResultGroups(rows: MetricRow[]): ResultGroup[] {
  const groups: Record<string, ObjectiveBucket> = {};

  // Column-presence signal (Priority 3), computed once per call from the
  // first row's own raw headers — same reasoning as aggregate.ts's
  // columnObjective: which columns exist is a property of the upload these
  // rows came from, identical for every row in it. Absent on an
  // already-aggregated AggRow (no _raw survives aggregateRows), which is
  // fine — those rows already carry a corrected result_type from
  // aggregateRows' own resolveObjective pass, so they resolve via Priority 2
  // here regardless.
  const campaignColumnObjectives = new Map<string, ResultLabels | null>();
  for (const row of rows) {
    const campaignKey = normalizeCampaignName(row.campaign_name || "");
    if (campaignColumnObjectives.has(campaignKey)) continue;
    const campRows = rows.filter((r) => normalizeCampaignName(r.campaign_name || "") === campaignKey);
    campaignColumnObjectives.set(campaignKey, columnObjectiveForCampaign(campRows));
  }

  rows.forEach((row) => {
    const columnObjective =
      campaignColumnObjectives.get(normalizeCampaignName(row.campaign_name || "")) ?? null;
    const { resultLabel: label, costLabel: cost } = resolveObjective(
      {
        result_type: row.result_type,
        results: parseCellNum(row.results),
        reach: parseCellNum(row.reach),
        purchases: parseCellNum(row.purchases),
        website_leads: parseCellNum(row.website_leads),
        meta_leads: parseCellNum(row.meta_leads),
        leads: parseCellNum(row.leads),
        landing_page_views: parseCellNum(row.landing_page_views),
        link_clicks: parseCellNum(row.link_clicks),
        // Present on a raw NreRow (via _raw) for the same reason as
        // detectObjectiveFromColumns' rawHeaders above; absent (→ 0/null,
        // correctly no-oping both checks) on an already-aggregated AggRow,
        // which has no _raw and whose result_type aggregateRows already
        // resolved correctly upstream via these same two signals.
        messaging_conversations_started: sumRawColumnByKeywords(row._raw, [
          "messaging conversations started",
          "whatsapp conversations started",
        ]),
        initiate_checkout: sumRawColumnByKeywords(row._raw, ["initiate checkout"]),
        add_to_cart: sumRawColumnByKeywords(row._raw, ["adds to cart", "add to cart"]),
        ad_set_name: row.ad_set_name,
      },
      columnObjective,
    );
    let group = groups[label];
    if (!group) {
      group = { costLabel: cost, count: 0, totalSpend: 0, totalReach: 0, rows: [] };
      groups[label] = group;
    }
    group.count += parseCellNum(row.results);
    group.totalSpend += parseCellNum(row.spend);
    (group.rows ??= []).push(row);
  });

  for (const g of Object.values(groups)) {
    g.totalReach = aggregateReachAcrossCampaigns(g.rows ?? []);
  }

  return buildResultGroups(groups);
}

/**
 * Normalizes a campaign name for case-insensitive matching — trimmed and
 * lower-cased. Closes a case-sensitivity loophole: without this, "Website
 * Leads Campaign" and "website leads campaign" (e.g. the same campaign
 * re-exported with different capitalization, or compared against a
 * differently-cased lookup key) would be treated as two distinct campaigns
 * — silently missing campaignObjectiveMap and falling back to the generic
 * RESULTS bucket instead of the campaign's real objective. Every place a
 * campaign name is grouped INTO campaignObjectiveMap (groupRowsByCampaign
 * below) or looked up FROM it (report-data.ts's campaign/ad-set slide
 * building) must run the name through this same function, or the two sides
 * can silently drift back out of sync.
 */
export function normalizeCampaignName(name: string | null | undefined): string {
  return String(name || "Unknown Campaign").trim().toLowerCase();
}

function groupRowsByCampaign(rows: MetricRow[]): Record<string, MetricRow[]> {
  const campaignRowGroups: Record<string, MetricRow[]> = {};
  rows.forEach((row) => {
    const name = normalizeCampaignName(row.campaign_name);
    (campaignRowGroups[name] ??= []).push(row);
  });
  return campaignRowGroups;
}

/** The "prefer a real objective over a pure-Reach one" selection shared by every campaign-level consumer below — top non-REACH group by count, or the top REACH group if that's genuinely all the campaign ran. Undefined only for an empty group list (a campaign with literally zero rows, which can't happen via groupRowsByCampaign's own grouping). */
function pickPrimaryResultGroup(campaignGroups: ResultGroup[]): ResultGroup | undefined {
  const nonReach = campaignGroups.filter((g) => g.label !== "REACH");
  return nonReach[0] || campaignGroups[0];
}

/**
 * Single source of truth for campaign objective detection (permanent
 * architectural fix for a reported bug: campaign slides and the Combined
 * Total table used to run objective detection independently — e.g. via
 * getGroupedResultDisplay for slides and the old getCampaignLevelResultGroups
 * for the table — and could disagree when fed row sets that overlapped but
 * weren't identical, so the table could show a different objective's column
 * than what a campaign's own slide displayed).
 *
 * Groups `rows` by campaign_name (normalized via normalizeCampaignName —
 * trimmed, lower-cased, so casing differences never fracture one campaign
 * into two map entries), resolves each campaign's rows via getResultGroups
 * (row-level resolveObjective, then the campaign-level pickPrimaryResultGroup
 * selection above), and returns ONE {resultLabel, costLabel} per normalized
 * campaign name. Every consumer that needs "what objective is this
 * campaign" — campaign slides, ad-set slides, and the Combined Total
 * table's column grouping (groupResultsByCampaignObjective below) — reads
 * from this same map instead of re-deriving its own answer, so they're
 * guaranteed to agree. A caller looking up a display-cased campaign name
 * (e.g. report-data.ts's campaignName, straight off the row) MUST run it
 * through normalizeCampaignName first, or a mixed-case lookup will silently
 * miss the map. Call once per relevant row set (report-data.ts builds one
 * from the current MTD/weekly rows, and a separate one from Previous Month
 * Data — see buildReportData's Step 0) rather than re-building it per
 * consumer.
 */
function isWebsiteLeadsResultTypeText(resultType: string | null | undefined): boolean {
  return resolveObjectiveFromResultType(resultType)?.key === "website_leads";
}

function isQuoteRequestResultTypeText(resultType: string | null | undefined): boolean {
  return resolveObjectiveFromResultType(resultType)?.key === "quote_requests";
}

/**
 * Objective Confirmation (permanent objective-detection fix) — per-campaign
 * objective resolution, now the single algorithm buildCampaignObjectiveMap
 * uses instead of getResultGroups + pickPrimaryResultGroup directly.
 *
 * Step 0 (Part 7 bug fix) — an explicit purchase-variant or
 * initiate-checkout result_type appearing on even ONE of this campaign's
 * rows is definitive proof of its real funnel objective, full stop, ahead of
 * every other signal below (including the dominant-result_type majority
 * check in Priority 1) — Meta only ever writes that text on a day the
 * underlying event counted as THE optimization result, so a single such day
 * outweighs every other blank-result_type day's raw Initiate Checkout/
 * Purchases column counts entirely. Real-account bug: a campaign with
 * "Website purchases" result_type on 1 of 30 days (and a blank result_type
 * on the other 29, which carried a bigger Initiate Checkout column total)
 * was misclassified as INITIATE CHECKOUT — Initiate Checkout simply
 * appearing more often is normal mid-funnel drop-off, not evidence of the
 * objective. Purchase text wins over Initiate Checkout text if a campaign
 * somehow has rows with both (deepest funnel event, same tie-break used
 * throughout this file).
 *
 * Priority 1 — the campaign's own DOMINANT result_type (the most common
 * non-empty result_type value across its rows — a campaign can, in
 * principle, carry more than one distinct value across different days if
 * the objective genuinely changed mid-flight; the majority wins), looked up
 * in result-type-map.ts's RESULT_TYPE_MAP for an EXACT match against Meta's
 * own machine-readable event names (e.g. "offsite_conversion.fb_pixel_purchase",
 * "onsite_conversion.lead_grouped"). This is Meta's own declaration of what
 * the campaign is optimized for — ground truth, trusted above every other
 * signal, with one documented exception immediately below.
 *
 * Special case — result_type = "landing_page_view" is Meta's own
 * intermediate/tracking signal, populated both by a genuine Traffic/LPV
 * campaign AND by a Sales campaign that happens to use "Landing Page View"
 * as its optimization event; the two are indistinguishable from result_type
 * text alone. A campaign with real Website Leads/Meta Leads column data is
 * unambiguously a lead-generation campaign using LPV as a mid-funnel
 * signal, not a genuine traffic campaign — so that specific combination
 * defers to Priority 2 below instead of trusting the exact map, letting the
 * existing dedicated-column-value priority correctly pick the real
 * objective. Every other result_type keeps trusting the exact map
 * unconditionally, even when some other column also happens to have data
 * (e.g. an Initiate Checkout campaign that also shows Purchases further
 * down the funnel stays INITIATE CHECKOUT, not PURCHASES).
 *
 * Priority 2 — falls through to the existing row-level priority chain
 * (resolveObjective's dedicated-column/fuzzy-catalog/column-presence/
 * data-value tiers, via getResultGroups + pickPrimaryResultGroup) for any
 * campaign whose dominant result_type has no RESULT_TYPE_MAP entry at all —
 * a blank result_type, or a rare/new event name it doesn't recognize.
 */
export interface ObjectiveConfidence extends ResultLabels {
  /**
   * Thing 2 (three-layer objective architecture rebuild) — the product's
   * 4-tier confidence scale, purely a UI signal for the wizard's Objective
   * Confirmation step; never affects which objective is actually returned
   * (resolveCampaignObjective/buildCampaignObjectiveMap strip this field
   * out entirely).
   *  - "high": result_type text was present and matched a known
   *    RESULT_TYPE_MAP entry (Step 0's explicit purchase/Initiate-Checkout
   *    match, or Priority 1's dominant-text match) — Meta's own declared
   *    objective, trusted completely.
   *  - "medium": no usable result_type text, but exactly one non-leads
   *    dedicated column (purchases, initiate checkout, add to cart,
   *    landing page views, link clicks, reach) has real, non-zero data —
   *    a single, unambiguous signal.
   *  - "low": no usable result_type text, and exactly one of the two
   *    lead-family columns (Website Leads / Meta Form Leads) has real
   *    data — still a single signal, but this is the pair agencies most
   *    often confuse, so it gets its own, more cautious tier.
   *  - "verify": genuinely ambiguous — BOTH lead columns have real data
   *    (can't tell which is this campaign's real objective), or NOTHING
   *    in the whole priority chain has real, non-zero data at all (the
   *    absolute last-resort RESULTS/COST PER RESULT bucket, or a bare
   *    ad-set-name guess).
   */
  confidence: "high" | "medium" | "low" | "verify";
  /** True only for "verify" — the wizard blocks Continue for this campaign until the user picks a value explicitly (see requiresConfirmation's own consumers in report-upload-wizard.tsx). */
  requiresConfirmation: boolean;
}

/**
 * Thing 2 (three-layer objective architecture rebuild) — refines the
 * "no usable result_type text" case into three finer-grained tiers,
 * re-examining the SAME dedicated-column totals resolveObjective's own
 * priority chain checks (website leads, meta form leads, purchases,
 * initiate checkout, add to cart, landing page views, link clicks, reach),
 * summed across every one of this campaign's rows. See ObjectiveConfidence
 * for what each returned tier means.
 */
function classifyLowConfidenceTier(rows: MetricRow[]): "medium" | "low" | "verify" {
  let websiteLeadsTotal = 0;
  let metaLeadsTotal = 0;
  let purchasesTotal = 0;
  let icTotal = 0;
  let atcTotal = 0;
  let landingPageViewsTotal = 0;
  let linkClicksTotal = 0;
  let reachTotal = 0;
  for (const row of rows) {
    websiteLeadsTotal += parseCellNum(row.website_leads);
    metaLeadsTotal += parseCellNum(row.leads) + parseCellNum(row.meta_leads);
    purchasesTotal += parseCellNum(row.purchases);
    icTotal += sumRawColumnByKeywords(row._raw, ["initiate checkout"]);
    atcTotal += sumRawColumnByKeywords(row._raw, ["adds to cart", "add to cart"]);
    landingPageViewsTotal += parseCellNum(row.landing_page_views);
    linkClicksTotal += parseCellNum(row.link_clicks);
    reachTotal += parseCellNum(row.reach);
  }

  const hasWebsiteLeads = websiteLeadsTotal > 0;
  const hasMetaLeads = metaLeadsTotal > 0;
  if (hasWebsiteLeads && hasMetaLeads) return "verify";
  if (hasWebsiteLeads || hasMetaLeads) return "low";

  const funnelSignalCount = [purchasesTotal, icTotal, atcTotal].filter((v) => v > 0).length;
  if (funnelSignalCount === 1) return "medium";
  if (funnelSignalCount > 1) return "low"; // ambiguous among funnel candidates — still a real guess, not one clean signal

  if (landingPageViewsTotal > 0 || linkClicksTotal > 0 || reachTotal > 0) return "medium";

  // Nothing at all — the generic RESULTS/COST PER RESULT bucket, or a bare
  // ad-set-name guess: no real numeric signal to trust.
  return "verify";
}

/**
 * Confidence for per-campaign lead-family detection. Website vs Meta form
 * leads stay "low" when only one is present (agencies often confuse them in
 * mixed exports). Messaging is treated separately — its dedicated column is
 * objective-specific (unlike link clicks), and messenger campaigns in a
 * mixed account are usually named explicitly.
 */
function classifyCampaignLeadConfidence(
  rows: MetricRow[],
  campaignLead: ResultLabels,
  messagingTotal: number,
  websiteLeadsTotal: number,
  metaLeadsTotal: number,
): ObjectiveConfidence["confidence"] {
  const messagingCampaign = isMessagingCampaignName(rows);
  const websiteLeadsCampaign = isWebsiteLeadsCampaignName(rows);

  if (campaignLead.resultLabel === MESSAGING_LABEL) {
    if (messagingTotal > 0) return "high";
    if (messagingCampaign) return "high";
    return "medium";
  }

  if (campaignLead.resultLabel === "WEBSITE LEADS") {
    if (websiteLeadsTotal > 0 && metaLeadsTotal > 0) return "verify";
    if (websiteLeadsTotal > 0 && websiteLeadsCampaign) return "high";
    if (websiteLeadsTotal > 0) return "low";
    if (websiteLeadsCampaign) return "high";
    return "medium";
  }

  if (campaignLead.resultLabel === "META FORM LEADS") {
    if (metaLeadsTotal > 0) return "low";
    return "medium";
  }

  const activeLeadFamilies = [messagingTotal > 0, websiteLeadsTotal > 0, metaLeadsTotal > 0].filter(Boolean).length;
  if (activeLeadFamilies > 1) return "verify";

  if (websiteLeadsTotal > 0 || metaLeadsTotal > 0) return "low";

  return "medium";
}

function sumCampaignMessagingTotal(rows: MetricRow[]): number {
  let total = 0;
  for (const row of rows) {
    total += sumRawColumnByKeywords(row._raw, [
      "messaging conversations started",
      "whatsapp conversations started",
    ]);
  }
  return total;
}

const TRAFFIC_ONLY_OBJECTIVE_LABELS = new Set(["LANDING PAGE VIEWS", "LINK CLICKS", "REACH"]);

/** Lead objective from campaign/ad-set naming alone — used when LPV/link-click columns exist in the export but the row has no lead yet. */
function leadObjectiveFromCampaignNameOnly(rows: MetricRow[]): ResultLabels | null {
  if (isMetaFormLeadsCampaignName(rows)) {
    return { resultLabel: "META FORM LEADS", costLabel: "COST PER LEAD" };
  }
  if (isWebsiteLeadsCampaignName(rows)) {
    return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
  }
  if (isQuoteRequestCampaignName(rows)) {
    return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE" };
  }
  return null;
}

function hasQuoteRequestResultTypeRows(rows: MetricRow[]): boolean {
  return rows.some((r) => resolveObjectiveFromResultType(r.result_type)?.key === "quote_requests");
}

function hasPurchasesColumnHeader(rows: MetricRow[]): boolean {
  if (rows.length === 0) return false;
  return Object.keys(rows[0]._raw || {}).some((h) => {
    const hl = h.toLowerCase();
    return (hl.includes("purchase") || hl.includes("purchases")) && !hl.includes("roas");
  });
}

/** Named purchase campaign + Purchases column in export → PURCHASES even when only mid-funnel data exists. */
function purchaseObjectiveIfNamedCampaign(rows: MetricRow[]): ResultLabels | null {
  if (!isPurchaseCampaignName(rows) || !hasPurchasesColumnHeader(rows)) return null;
  return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };
}

/** Stray messaging counts on website campaigns (shared export columns) vs real traffic. */
function isIncidentalMessagingForWebsiteCampaign(rows: MetricRow[], messagingTotal: number): boolean {
  let linkClicks = 0;
  let landingPageViews = 0;
  for (const row of rows) {
    linkClicks += parseCellNum(row.link_clicks);
    landingPageViews += parseCellNum(row.landing_page_views);
  }
  const traffic = Math.max(linkClicks, landingPageViews);
  if (traffic <= 0) return false;
  return messagingTotal <= Math.max(1, Math.floor(traffic * 0.05));
}

/** Meta always populates link clicks / LPV / generic lead result_types on lead campaigns — never trust them over real messaging column data or a messaging campaign name. */
function shouldIgnoreDominantResultType(rows: MetricRow[], dominantResultType: string): boolean {
  const rt = dominantResultType.toLowerCase().trim();
  const messagingTotal = sumCampaignMessagingTotal(rows);
  const isMessagingCampaign = isMessagingCampaignName(rows);

  if (
    rt === "link_click" ||
    rt === "link clicks" ||
    rt === "link click" ||
    rt === "landing_page_view"
  ) {
    return messagingTotal > 0 || isMessagingCampaign;
  }

  const metaLeadResultTypes = new Set([
    "onsite_conversion.lead_grouped",
    "onsite_conversion.lead",
    "leadgen_grouped",
    "leads (form)",
    "meta lead",
    "meta leads",
    "lead",
  ]);
  if (metaLeadResultTypes.has(rt) && isMessagingCampaign) {
    return true;
  }

  const messagingResultTypes = new Set([
    "onsite_conversion.messaging_conversation_started_7d",
    "messaging_conversation_started_7d",
    "onsite_conversion.messaging_first_reply_7d",
    "new_messaging_connection",
    "messaging conversations started",
  ]);
  if (messagingResultTypes.has(rt) && !isMessagingCampaign) {
    const websiteLeadsTotal = rows.reduce((sum, r) => sum + parseCellNum(r.website_leads), 0);
    if (websiteLeadsTotal > 0 || isWebsiteLeadsCampaignName(rows)) return true;
    const metaLeadsTotal = rows.reduce(
      (sum, r) => sum + parseCellNum(r.meta_leads) + parseCellNum(r.leads) + parseCellNum(r.results),
      0,
    );
    if (metaLeadsTotal > 0 || isMetaFormLeadsCampaignName(rows)) return true;
    if (isQuoteRequestCampaignName(rows) || hasQuoteRequestResultTypeRows(rows)) return true;
  }

  return false;
}

/** Same incidental-traffic guards as shouldIgnoreDominantResultType, for the unique-mapped shortcut. */
function shouldIgnoreUniqueMappedObjective(rows: MetricRow[], info: { key: string; resultLabel: string }): boolean {
  if (info.key === "landing_page_views") {
    const hasRealLeadsColumnData = rows.some(
      (r) => parseCellNum(r.website_leads) > 0 || parseCellNum(r.leads) > 0 || parseCellNum(r.meta_leads) > 0,
    );
    if (hasRealLeadsColumnData) return true;
  }
  if (info.key === "landing_page_views" || info.key === "link_clicks") {
    return shouldIgnoreDominantResultType(rows, info.key === "link_clicks" ? "link_click" : "landing_page_view");
  }
  if (info.key === "meta_form_leads") {
    return isMessagingCampaignName(rows) && sumCampaignMessagingTotal(rows) > 0;
  }
  if (info.key === "messaging") {
    const websiteLeadsTotal = rows.reduce((sum, r) => sum + parseCellNum(r.website_leads), 0);
    if (websiteLeadsTotal > 0 || isWebsiteLeadsCampaignName(rows)) return true;
    const metaLeadsTotal = rows.reduce(
      (sum, r) => sum + parseCellNum(r.meta_leads) + parseCellNum(r.leads) + parseCellNum(r.results),
      0,
    );
    if (metaLeadsTotal > 0 || isMetaFormLeadsCampaignName(rows)) return true;
    if (isQuoteRequestCampaignName(rows) || hasQuoteRequestResultTypeRows(rows)) return true;
  }
  return false;
}

/** Internal implementation shared by resolveCampaignObjective (public, unchanged signature — every existing caller/test keeps working exactly as before) and resolveCampaignObjectiveWithConfidence (new — the Objective Confirmation wizard step's own confidence badge, Part 6). See resolveCampaignObjective's own doc comment above for the full priority-chain writeup. */
function shouldOverrideDefinitiveProof(rows: MetricRow[], info: ObjectiveInfo): boolean {
  if (info.key === "meta_form_leads" && isMessagingCampaignName(rows)) {
    if (sumCampaignMessagingTotal(rows) > 0) return true;
    const headers = Object.keys(rows[0]?._raw || {});
    if (headers.some((h) => h.toLowerCase().includes("messaging conversations started"))) return true;
  }
  return false;
}

function resolveCampaignObjectiveDetailed(rows: MetricRow[]): ObjectiveConfidence {
  const definitive = resolveDefinitiveObjectiveFromRows(rows, resolveObjectiveFromResultType);
  if (definitive && !shouldOverrideDefinitiveProof(rows, definitive)) {
    return {
      resultLabel: definitive.resultLabel,
      costLabel: definitive.costLabel,
      confidence: "high",
      requiresConfirmation: false,
    };
  }

  const uniqueMapped = resolveUniqueMappedObjectiveFromRows(rows, resolveObjectiveFromResultType);
  if (uniqueMapped && !shouldIgnoreUniqueMappedObjective(rows, uniqueMapped)) {
    return {
      resultLabel: uniqueMapped.resultLabel,
      costLabel: uniqueMapped.costLabel,
      confidence: "high",
      requiresConfirmation: false,
    };
  }

  const resultTypeCounts = new Map<string, number>();
  let blankCount = 0;
  for (const row of rows) {
    const rt = (row.result_type || "").toLowerCase().trim();
    if (rt) resultTypeCounts.set(rt, (resultTypeCounts.get(rt) ?? 0) + 1);
    else blankCount++;
  }

  let dominantResultType = "";
  let maxCount = 0;
  for (const [rt, count] of resultTypeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantResultType = rt;
    }
  }

  // A non-blank result_type must genuinely be this campaign's dominant
  // signal — outnumbering rows with NO result_type opinion at all — before
  // it's trusted as ground truth. Without this, a single stray/incidental
  // row that happens to carry SOME result_type (e.g. one Reach-flavored row
  // in an otherwise blank-result_type Website Leads campaign) would win by
  // default against a much larger blank-result_type majority that Priority
  // 2's dedicated-column check would otherwise have resolved correctly —
  // exactly the "phantom objective from a minority in-campaign signal" bug
  // this whole map was built to prevent.
  if (dominantResultType && maxCount > blankCount) {
    const isLandingPageViewSpecialCase = dominantResultType === "landing_page_view";
    const hasRealLeadsColumnData =
      isLandingPageViewSpecialCase &&
      rows.some(
        (r) => parseCellNum(r.website_leads) > 0 || parseCellNum(r.leads) > 0 || parseCellNum(r.meta_leads) > 0,
      );
    const ignoreIncidentalTraffic =
      shouldIgnoreDominantResultType(rows, dominantResultType);
    if ((!isLandingPageViewSpecialCase || !hasRealLeadsColumnData) && !ignoreIncidentalTraffic) {
      const info = resolveObjectiveFromResultType(dominantResultType);
      if (info) return { resultLabel: info.resultLabel, costLabel: info.costLabel, confidence: "high", requiresConfirmation: false };
    }
    // isLandingPageViewSpecialCase && hasRealLeadsColumnData falls through
    // to Priority 2, which already ranks a nonzero Website Leads/Meta Leads
    // column above a plain "LANDING PAGE VIEWS" result.
  }

  // Priority 2, Purchases/Initiate Checkout/Add To Cart case only (Part 7
  // bug fix, Steps 3-4) — result_type is completely blank on EVERY row (Step
  // 0 above already ruled out any explicit purchase/IC text, and
  // resultTypeCounts being empty means no OTHER result_type text exists
  // either), so there is no text signal left to trust at all. Rather than
  // falling through to the old per-row race (getResultGroups below, which
  // would let Initiate Checkout's typically-larger raw count win by the same
  // flawed reasoning Step 0 exists to override), sum each dedicated column
  // across the WHOLE campaign and compare each to the campaign's own Results
  // column total — Meta's own declared primary conversion metric — picking
  // whichever funnel column sums closest to it. Falls through unchanged to
  // Priority 2's generic per-row resolution for every other objective
  // (leads, reach, app installs, ...), which this block never touches.
  if (resultTypeCounts.size === 0) {
    let resultsTotal = 0;
    let purchasesTotal = 0;
    let icTotal = 0;
    let atcTotal = 0;
    for (const row of rows) {
      resultsTotal += parseCellNum(row.results);
      purchasesTotal += parseCellNum(row.purchases);
      icTotal += sumRawColumnByKeywords(row._raw, ["initiate checkout"]);
      atcTotal += sumRawColumnByKeywords(row._raw, ["adds to cart", "add to cart"]);
    }

    const purchaseNamed = purchaseObjectiveIfNamedCampaign(rows);
    if (purchaseNamed) {
      return {
        ...purchaseNamed,
        confidence: purchasesTotal > 0 ? "high" : "medium",
        requiresConfirmation: false,
      };
    }

    const funnelCandidates = [
      { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", value: purchasesTotal },
      { resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT", value: icTotal },
      { resultLabel: "ADD TO CART", costLabel: "COST PER ADD TO CART", value: atcTotal },
    ].filter((c) => c.value > 0);
    if (funnelCandidates.length > 0) {
      let best = funnelCandidates[0];
      let bestDiff = Math.abs(funnelCandidates[0].value - resultsTotal);
      for (const c of funnelCandidates.slice(1)) {
        const diff = Math.abs(c.value - resultsTotal);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = c;
        }
      }
      // Thing 2 — a single funnel candidate is a clean, unambiguous signal
      // ("medium"); more than one competing for the same slot (resolved
      // above only via the closest-to-Results heuristic) is still a real
      // guess ("low"), never "verify" — the campaign genuinely optimizes
      // for one of these three, this is purely which one.
      const tier = funnelCandidates.length === 1 ? "medium" : "low";
      return { resultLabel: best.resultLabel, costLabel: best.costLabel, confidence: tier, requiresConfirmation: false };
    }
  }

  const campaignLead = detectObjectiveFromCampaignRows(rows);
  if (campaignLead) {
    let websiteLeadsTotal = 0;
    let metaLeadsTotal = 0;
    let messagingTotal = 0;
    for (const row of rows) {
      websiteLeadsTotal += parseCellNum(row.website_leads);
      metaLeadsTotal += parseCellNum(row.leads) + parseCellNum(row.meta_leads);
      messagingTotal += sumRawColumnByKeywords(row._raw, [
        "messaging conversations started",
        "whatsapp conversations started",
      ]);
    }
    const tier = classifyCampaignLeadConfidence(
      rows,
      campaignLead,
      messagingTotal,
      websiteLeadsTotal,
      metaLeadsTotal,
    );
    return {
      ...campaignLead,
      confidence: tier,
      requiresConfirmation: tier === "verify",
    };
  }

  const columnFallback = columnObjectiveForCampaign(rows);
  if (columnFallback) {
    return {
      ...columnFallback,
      confidence: "medium",
      requiresConfirmation: false,
    };
  }

  const primary = pickPrimaryResultGroup(getResultGroups(rows));
  const fallbackTier = classifyLowConfidenceTier(rows);
  return {
    resultLabel: primary?.label ?? "RESULTS",
    costLabel: primary?.costLabel ?? "COST PER RESULT",
    confidence: fallbackTier,
    requiresConfirmation: fallbackTier === "verify",
  };
}

export function resolveCampaignObjective(rows: MetricRow[]): ResultLabels {
  const { resultLabel, costLabel } = resolveCampaignObjectiveDetailed(rows);
  return { resultLabel, costLabel };
}

/** Objective Confirmation memory cache (Part 6) — same detection as resolveCampaignObjective, plus a confidence tag the wizard uses for per-campaign badges ("Detected — change if wrong" vs red "Confirmation required"). Never used for report generation itself (buildCampaignObjectiveMap/resolveCampaignObjective above are unaffected) — display-only. */
export function resolveCampaignObjectiveWithConfidence(rows: MetricRow[]): ObjectiveConfidence {
  return resolveCampaignObjectiveDetailed(rows);
}

export function buildCampaignObjectiveMap(rows: MetricRow[]): Map<string, ResultLabels> {
  const map = new Map<string, ResultLabels>();
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    map.set(name, resolveCampaignObjective(campRows));
  });
  return map;
}

/** Objective Confirmation memory cache (Part 6) — buildCampaignObjectiveMap's confidence-carrying counterpart, for the wizard's own /metrics route (the only consumer that needs the "high"/"low" badge; every other buildCampaignObjectiveMap call site is unaffected). */
export function buildCampaignObjectiveMapWithConfidence(rows: MetricRow[]): Map<string, ObjectiveConfidence> {
  const map = new Map<string, ObjectiveConfidence>();
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    map.set(name, resolveCampaignObjectiveWithConfidence(campRows));
  });
  return map;
}

/** A row's own initiate_checkout/add_to_cart signal — its dedicated numeric field when present (an AggRow, post this round's fix), else summed straight from _raw (a raw NreRow, which has no dedicated column for either). Shared by resultValueForObjective's own reads below and its resolveObjective call, so both agree on the same number. */
function rowInitiateCheckout(row: MetricRow): number {
  return row.initiate_checkout !== undefined ? parseCellNum(row.initiate_checkout) : sumRawColumnByKeywords(row._raw, ["initiate checkout"]);
}
function rowAddToCart(row: MetricRow): number {
  return row.add_to_cart !== undefined
    ? parseCellNum(row.add_to_cart)
    : sumRawColumnByKeywords(row._raw, ["adds to cart", "add to cart"]);
}

/**
 * MTD-row bug fix (Combined Total table showing inflated Purchases counts) —
 * a CAMPAIGN can contain multiple ad-set-level rows/groups, each with its
 * OWN independently-resolved `results` value (aggregate.ts's actualResults
 * correction sets each ad-set-group's `results` to whatever THAT group's own
 * classification decided — e.g. its own Purchases count, or its own
 * Initiate Checkout count if that ad set individually leaned that way).
 * groupResultsByCampaignObjective below assigns the whole CAMPAIGN to ONE
 * objective bucket, but used to sum every one of its rows' `results` blindly
 * into that bucket regardless of what each row's OWN results actually
 * measured — so a Purchases-classified campaign with one ad set correctly
 * showing 3 purchases and another ad set whose own classification leaned
 * Initiate Checkout (results = 12 ICs) summed to 15 "purchases", not 3.
 *
 * The fix: first re-derive THIS row's own resolved objective by feeding it,
 * alone, through resolveCampaignObjective — the EXACT SAME algorithm that
 * built the campaign's own assigned objective in the first place (Step 0's
 * explicit-text check, RESULT_TYPE_MAP's exact machine-string match, the
 * landing_page_view special case, then the row-level resolveObjective
 * fallback chain). Reusing the identical function (rather than a
 * hand-rolled subset of it) guarantees this row-level check can never
 * disagree with the campaign-level check over which text/signal wins —
 * they're the same code. When this row's own label agrees with `label`,
 * `results` already measures the right thing — use it as-is (the
 * overwhelmingly common case: an ordinary single-objective campaign, where
 * every row agrees). Only when a row's own objective genuinely DIFFERS from
 * the campaign's assigned objective (the mixed-ad-set bug case) does it
 * switch to that row's own dedicated metric field for `label` instead (its
 * real, possibly secondary/incidental, possibly zero count for that
 * specific event) — a mismatched row's `results` is never trusted, since it
 * measures an entirely different metric.
 *
 * Exported (not just used internally by groupResultsByCampaignObjective
 * below) so every other consumer that sums a campaign's rows against a
 * SINGLE forced objective from campaignObjectiveMap — report-data.ts's
 * Comparison Report campaign totals being the other one, as of this fix —
 * gets the same mismatched-row correction instead of reimplementing it.
 */
export function resultValueForObjective(row: MetricRow, label: string): number {
  const ownLabel = resolveCampaignObjective([row]).resultLabel;

  if (ownLabel === label) {
    if (label === "LINK CLICKS") {
      return parseCellNum(row.link_clicks) || parseCellNum(row.results);
    }
    if (label === "LANDING PAGE VIEWS") {
      return parseCellNum(row.landing_page_views) || parseCellNum(row.results);
    }
    if (label === "WEBSITE LEADS") {
      // Results = Meta's attributed result for the row's Result type (e.g.
      // "Website applications submitted"). Website leads column can differ on
      // the same day — prefer Results; fall back to website_leads when Results
      // is blank (API-sync rows or sparse exports).
      return parseCellNum(row.results) || parseCellNum(row.website_leads);
    }
    if (label === "META FORM LEADS") {
      return parseCellNum(row.results) || parseCellNum(row.meta_leads) || parseCellNum(row.leads);
    }
    return parseCellNum(row.results);
  }
  // Campaign names like "* website leads *" plus a Website leads column in
  // the export can make per-row detection resolve to WEBSITE LEADS even when
  // Result type is "Quote Request Submitted". The Combined Total table still
  // groups the campaign under QUOTE REQUESTS (from result_type at map
  // build time) — honor the row's explicit Result type when it matches the
  // bucket being summed.
  const rowResultLabel = getResultLabels(row.result_type).resultLabel;
  if (rowResultLabel === label) {
    return parseCellNum(row.results);
  }
  if (label === "PURCHASES") return parseCellNum(row.purchases);
  if (label === "INITIATE CHECKOUT") return rowInitiateCheckout(row);
  if (label === "ADD TO CART") return rowAddToCart(row);
  if (label === "LINK CLICKS") return parseCellNum(row.link_clicks);
  // No dedicated field tracks any other objective (Leads, Reach, ...) on a
  // mismatched row — it contributes nothing to a bucket it has no real
  // metric for, rather than reusing `results`, which measures something
  // else entirely for this specific row.
  return 0;
}

/**
 * Daily Meta exports often have zero-lead days (blank result_type, link
 * clicks only) inside an ad set that otherwise produces leads. Row-level
 * resolveObjective labels those days LINK CLICKS / LPV, which used to drop
 * their spend from CPL while Ad Spend still counted it — GZ Australia Aug
 * CPL bug (1795/43 showed $37.67, not 41.74). Only dated rows in an ad
 * set that also has lead days qualify; undated fixture rows (minority LPV/
 * Reach signals in tests) stay excluded.
 */
function isDailyOffDayInLeadCampaign(row: MetricRow, campRows: MetricRow[], ownLabel: string): boolean {
  if (!hasRealRowDate(row)) return false;
  if (parseCellNum(row.results) > 0) return false;
  if (parseCellNum(row.website_leads) > 0 || parseCellNum(row.meta_leads) > 0 || parseCellNum(row.leads) > 0) {
    return false;
  }
  const rt = (row.result_type || "").trim();
  if (rt && getResultLabels(rt).resultLabel !== "RESULTS") return false;

  const adSet = row.ad_set_name || "";
  const adSetHasLeadDays = campRows.some(
    (r) => (r.ad_set_name || "") === adSet && parseCellNum(r.results) > 0 && hasRealRowDate(r),
  );
  if (!adSetHasLeadDays) return false;

  if (ownLabel === "LINK CLICKS") return parseCellNum(row.link_clicks) > 0;
  if (ownLabel === "LANDING PAGE VIEWS") {
    const lpv = parseCellNum(row.landing_page_views);
    return lpv > 0 && lpv <= 3;
  }
  if (ownLabel === "RESULTS") return !rt;
  return false;
}

/** Spend/reach roll into an objective bucket only when the row contributes to that objective's results (or spent on that objective with zero results). Prevents another objective's spend from inflating cost-per on the chart slide and Combined Total table. */
export function shouldAttributeSpendForObjective(
  row: MetricRow,
  label: string,
  attributedValue: number,
  campaignObjectiveLabel?: string,
  campRows?: MetricRow[],
): boolean {
  if (attributedValue > 0) return true;
  const ownLabel = resolveCampaignObjective([row]).resultLabel;
  if (ownLabel === label) return true;
  if (
    campaignObjectiveLabel === label &&
    campRows &&
    isDailyOffDayInLeadCampaign(row, campRows, ownLabel)
  ) {
    return true;
  }
  return false;
}

/**
 * Turns `rows` into per-objective ResultGroup[] for the Combined Total
 * table, using a PRE-BUILT campaignObjectiveMap (see buildCampaignObjectiveMap
 * above) instead of independently re-detecting each campaign's objective —
 * replaces the old getCampaignLevelResultGroups, whose self-contained
 * re-detection was the actual source of the campaign-slide/table
 * disagreement this fixes. A campaign's ENTIRE spend/results/reach still
 * rolls into its one mapped objective's bucket, never split across multiple
 * labels within one campaign (same "no phantom column from a secondary
 * in-campaign signal" guarantee the old function made) — the only change is
 * WHERE the objective assignment comes from. Falls back to the generic
 * RESULTS bucket for a campaign name absent from objectiveMap (defensive
 * only: every call site below passes the same rows the map was itself built
 * from, so this should never actually trigger).
 *
 * `debugLabel`, when passed (report-data.ts's computeTableRow passes "MTD"
 * or "Previous Month"), prints one console.log line per campaign — its
 * assigned objective, the value actually read for that objective, and the
 * running total for that objective's bucket — so a reported "wrong number"
 * bug can be traced to the exact campaign/row producing it without a
 * debugger. No-op (nothing printed) when omitted, same as before this
 * existed.
 */
export function groupResultsByCampaignObjective(
  rows: MetricRow[],
  objectiveMap: Map<string, ResultLabels>,
  debugLabel?: string,
): ResultGroup[] {
  const groups: Record<string, ObjectiveBucket> = {};
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    const objective = objectiveMap.get(name) ?? { resultLabel: "RESULTS", costLabel: "COST PER RESULT" };
    const label = objective.resultLabel;
    if (!groups[label]) groups[label] = { costLabel: objective.costLabel, count: 0, totalSpend: 0, totalReach: 0 };
    let campaignValueSum = 0;
    let campaignReachAdded = false;
    campRows.forEach((row) => {
      const value = resultValueForObjective(row, label);
      groups[label].count += value;
      if (shouldAttributeSpendForObjective(row, label, value, objective.resultLabel, campRows)) {
        groups[label].totalSpend += parseCellNum(row.spend);
        if (!campaignReachAdded) {
          groups[label].totalReach += aggregateReach(campRows);
          campaignReachAdded = true;
        }
      }
      campaignValueSum += value;
      if (debugLabel) {
        console.log(
          `[${debugLabel}] campaign="${name}" ad_set="${row.ad_set_name ?? ""}" objective=${label} ` +
            `ownLabel=${resolveCampaignObjective([row]).resultLabel} row.result_type="${row.result_type ?? ""}" ` +
            `row.purchases=${row.purchases ?? "undefined"} row.results=${String(row.results ?? "undefined")} ` +
            `valueUsed=${value} runningCampaignTotal=${campaignValueSum}`,
        );
      }
    });
    if (debugLabel) {
      console.log(`[${debugLabel}] campaign="${name}" TOTAL for objective=${label}: ${campaignValueSum} (bucket running total: ${groups[label].count})`);
    }
  });

  return buildResultGroups(groups);
}

export interface ResultDisplay {
  resultLabel: string;
  costLabel: string;
  resultValue: string;
  cprValue: string;
}

/** Port of getGroupedResultDisplay_ — for a CAMPAIGN SUMMARY (all ad sets in the campaign). */
export function getGroupedResultDisplay(campRows: MetricRow[], currencySymbol: string): ResultDisplay {
  const allGroups = getResultGroups(campRows);
  const REACH_LABELS = ["REACH"];
  const groups = allGroups.filter((g) => !REACH_LABELS.includes(g.label));
  const g1 = groups[0] || allGroups[0] || { label: "RESULTS", costLabel: "COST PER RESULT", count: 0, avgCpr: 0 };
  return {
    resultLabel: g1.label,
    costLabel: g1.costLabel,
    resultValue: g1.count > 0 ? fmtNumber(g1.count) : "0",
    cprValue: g1.avgCpr > 0 ? fmtCurrency2dp(g1.avgCpr, currencySymbol) : "—",
  };
}

/** Port of getSingleRowResultDisplay_ — for a SINGLE AD SET row. */
export function getSingleRowResultDisplay(row: AggRow, currencySymbol: string): ResultDisplay {
  const labels = getResultLabels(row.result_type || "");
  const results = parseCellNum(row.results);
  const cpr = parseCellNum(row.cpr);
  return {
    resultLabel: labels.resultLabel,
    costLabel: labels.costLabel,
    resultValue: results > 0 ? fmtNumber(results) : "0",
    cprValue: cpr > 0 ? fmtCurrency2dp(cpr, currencySymbol) : "—",
  };
}

/**
 * Single-source-of-truth counterpart to getGroupedResultDisplay — for a
 * CAMPAIGN SUMMARY slide, reading the objective from a pre-built
 * campaignObjectiveMap (see buildCampaignObjectiveMap) instead of
 * independently re-deriving it from campRows. Sums this campaign's ENTIRE
 * row set (every ad set, regardless of that ad set's own row-level
 * objective) into the one mapped objective — the same "whole campaign rolls
 * into its one assigned objective" rule groupResultsByCampaignObjective
 * applies for the Combined Total table, so a campaign slide's displayed
 * count/cost always matches what the table shows for that same campaign.
 */
export function getGroupedResultDisplayForObjective(
  campRows: MetricRow[],
  objective: ResultLabels,
  currencySymbol: string,
): ResultDisplay {
  // MTD-row bug fix, extended to campaign slides — see
  // groupResultsByCampaignObjective's own doc comment and
  // resultValueForObjective for the full rationale: a campaign summary
  // must never sum an ad set's `results` when that ad set's OWN resolved
  // objective differs from the campaign's assigned one (e.g. an Initiate-
  // Checkout-leaning ad set inside an overall Purchases campaign), so a
  // campaign slide's shown count always matches what the Combined Total
  // table shows for that same campaign.
  let count = 0;
  let totalSpend = 0;
  let totalReach = 0;
  let campaignReachAdded = false;
  campRows.forEach((row) => {
    const value = resultValueForObjective(row, objective.resultLabel);
    count += value;
    if (shouldAttributeSpendForObjective(row, objective.resultLabel, value, objective.resultLabel, campRows)) {
      totalSpend += parseCellNum(row.spend);
      if (!campaignReachAdded) {
        totalReach = aggregateReach(campRows);
        campaignReachAdded = true;
      }
    }
  });

  // Same uncounted-Reach special case as buildResultGroups: a real Reach
  // objective rarely populates a `results` count, so its cost is derived
  // from spend/reach (×1000) instead of spend/count.
  const isUncountedReach = objective.resultLabel === "REACH" && count === 0;
  let cprValue: string;
  if (isUncountedReach) {
    const reachCpr = totalReach > 0 ? (totalSpend * 1000) / totalReach : 0;
    cprValue = reachCpr > 0 ? fmtCurrency2dp(reachCpr, currencySymbol) : "—";
  } else if (count > 0) {
    cprValue = fmtCurrency2dp(totalSpend / count, currencySymbol);
  } else if (totalSpend > 0) {
    // Real spend, zero results — the cost is genuinely undefined, not "$0.00".
    cprValue = "N/A";
  } else {
    cprValue = "—";
  }

  return {
    resultLabel: objective.resultLabel,
    costLabel: objective.costLabel,
    resultValue: count > 0 ? fmtNumber(count) : "0",
    cprValue,
  };
}

/**
 * Single-source-of-truth counterpart to getSingleRowResultDisplay — for a
 * SINGLE AD SET row, reading the resultLabel/costLabel from the PARENT
 * campaign's own objective (via campaignObjectiveMap) instead of that row's
 * own individually-resolved result_type, so every ad-set slide under one
 * campaign always agrees with that campaign's own summary slide and with
 * the Combined Total table.
 *
 * MTD-row bug fix, extended to ad-set slides — the row's own `results`/`cpr`
 * are no longer trusted as-is: when THIS ad set's own resolved objective
 * differs from the campaign's assigned one (e.g. this ad set individually
 * leans Initiate Checkout inside an overall Purchases campaign), `results`
 * measures the wrong metric entirely — resultValueForObjective reads its
 * dedicated field for the campaign's real objective instead (its own,
 * possibly zero, count for that specific event). cpr is then recomputed
 * from spend/count (never the precomputed `row.cpr`, which was calculated
 * against this ad set's own — possibly different — objective) so the two
 * numbers never disagree; for the common case where this ad set's own
 * objective already matches the campaign's, both formulas are identical
 * (spend/results) and the displayed numbers are unchanged.
 */
export function getSingleRowResultDisplayForObjective(row: AggRow, objective: ResultLabels, currencySymbol: string): ResultDisplay {
  const results = resultValueForObjective(row, objective.resultLabel);
  const spend = parseCellNum(row.spend);
  const reach = parseCellNum(row.reach);
  // Same uncounted-Reach special case as getGroupedResultDisplayForObjective.
  const isUncountedReach = objective.resultLabel === "REACH" && results === 0;
  let cprValue: string;
  if (isUncountedReach) {
    const reachCpr = reach > 0 ? (spend * 1000) / reach : 0;
    cprValue = reachCpr > 0 ? fmtCurrency2dp(reachCpr, currencySymbol) : "—";
  } else if (results > 0) {
    cprValue = fmtCurrency2dp(spend / results, currencySymbol);
  } else if (spend > 0) {
    cprValue = "N/A";
  } else {
    cprValue = "—";
  }
  return {
    resultLabel: objective.resultLabel,
    costLabel: objective.costLabel,
    resultValue: results > 0 ? fmtNumber(results) : "0",
    cprValue,
  };
}
