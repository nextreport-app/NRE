/**
 * NRE v1 — result-type / objective label detection.
 * Direct port of getResultLabels_ / getResultGroups_ / getGroupedResultDisplay_ /
 * getSingleRowResultDisplay_ from meta_ads_report_v4.js, since substantially
 * extended (product owner, from real-account bug reports) into a 4-step
 * priority chain — see the comment above OBJECTIVE_CATALOG.
 */

import { parseCellNum, fmtNumber, fmtCurrency2dp } from "./format";
import type { MetricRow } from "./types";
import type { AggRow } from "./aggregate";
import { RESULT_TYPE_MAP, resolveObjectiveFromResultType, type ObjectiveInfo } from "./result-type-map";

export interface ResultLabels {
  resultLabel: string;
  costLabel: string;
}

/**
 * The full objective dictionary — the single source of truth for every
 * distinct objective NextReport recognizes. Each entry's `pattern` is what
 * Step 1 (getResultLabels) matches against result_type text, and its
 * `canonicalText` is a string GUARANTEED to match that same `pattern` when
 * fed back through getResultLabels — required because Steps 2-4
 * (aggregate.ts's column-presence and data-value corrections) write a
 * synthetic result_type back onto the aggregated row, which every
 * downstream consumer (getResultGroups, getSingleRowResultDisplay, the MTD
 * chart) re-derives its label from by calling getResultLabels again. Using
 * the resultLabel itself (e.g. "META FORM LEADS") as that synthetic text
 * would NOT reliably round-trip — plenty of these labels don't literally
 * appear in their own pattern (e.g. "meta form leads" doesn't match
 * `meta\s*leads?`) — so canonicalText exists specifically to guarantee it.
 *
 * Order is priority order: checked top to bottom, first match wins, most
 * specific first — exactly the reasoning the original code already
 * documented for "Leads (form)" vs generic "LEADS" and "Submit application"
 * vs the app-install bucket. One deliberate reordering vs the literal list
 * this was specified from: APP EVENTS ("in-app purchase") is checked before
 * PURCHASES ("purchase") — "in-app purchase" contains "purchase" as a
 * substring, so left in the given order it would always match PURCHASES
 * first and APP EVENTS would be unreachable.
 */
const OBJECTIVE_CATALOG: { resultLabel: string; costLabel: string; pattern: RegExp; canonicalText: string }[] = [
  {
    resultLabel: "WEBSITE LEADS",
    costLabel: "COST PER WEBSITE LEAD",
    pattern: /website\s*leads?|web\s*leads?|leads?\s*\(\s*website\s*\)|\bcontact\b/,
    canonicalText: "Website lead",
  },
  {
    resultLabel: "META FORM LEADS",
    costLabel: "COST PER LEAD",
    pattern: /instant\s*forms?|meta\s*leads?|leads?\s*forms?|forms?\s*leads?|leads?\s*\(\s*form\s*\)/,
    canonicalText: "Meta lead",
  },
  {
    resultLabel: "MESSAGING LEADS",
    costLabel: "COST PER CONVERSATION",
    pattern: /messaging\s*conversations?|messenger\s*leads?|message\s*starts?/,
    canonicalText: "Messenger lead",
  },
  {
    resultLabel: "INSTAGRAM DM LEADS",
    costLabel: "COST PER CONVERSATION",
    pattern: /instagram\s*conversations?|instagram\s*dm/,
    canonicalText: "Instagram DM",
  },
  {
    resultLabel: "WHATSAPP LEADS",
    costLabel: "COST PER CONVERSATION",
    pattern: /whatsapp\s*conversations?|whatsapp\s*leads?/,
    canonicalText: "Whatsapp lead",
  },
  {
    resultLabel: "CALL LEADS",
    costLabel: "COST PER CALL",
    pattern: /phone\s*calls?|call\s*leads?|\bcalls?\b/,
    canonicalText: "Call lead",
  },
  {
    resultLabel: "APPOINTMENT LEADS",
    costLabel: "COST PER BOOKING",
    pattern: /appointments?|bookings?/,
    canonicalText: "Appointment",
  },
  {
    resultLabel: "REGISTRATIONS",
    costLabel: "COST PER REGISTRATION",
    pattern: /complete\s*registrations?|registrations?/,
    canonicalText: "Registration",
  },
  {
    resultLabel: "APPLICATIONS",
    costLabel: "COST PER APPLICATION",
    pattern: /submit\s*applications?|applications?/,
    canonicalText: "Application",
  },
  {
    resultLabel: "SUBSCRIPTIONS",
    costLabel: "COST PER SUBSCRIPTION",
    pattern: /subscribe|subscriptions?/,
    canonicalText: "Subscription",
  },
  {
    resultLabel: "CONVERSIONS",
    costLabel: "COST PER CONVERSION",
    pattern: /custom\s*conversions?/,
    canonicalText: "Custom conversion",
  },
  // Checked before PURCHASES — "in-app purchase" contains "purchase" as a
  // substring, so it must be matched here first (see catalog doc comment).
  {
    resultLabel: "APP EVENTS",
    costLabel: "COST PER APP EVENT",
    pattern: /app\s*events?|in-?app\s*purchases?/,
    canonicalText: "App event",
  },
  {
    resultLabel: "PURCHASES",
    costLabel: "COST PER PURCHASE",
    pattern: /purchases?|\bbuy\b|checkout\s*complete|\border\b/,
    canonicalText: "Purchase",
  },
  {
    resultLabel: "ADD TO CART",
    costLabel: "COST PER ADD TO CART",
    pattern: /add\s*to\s*cart|addtocart/,
    canonicalText: "Add to cart",
  },
  {
    resultLabel: "INITIATE CHECKOUT",
    costLabel: "COST PER CHECKOUT",
    pattern: /initiate\s*checkout|initiatecheckout/,
    canonicalText: "Initiate checkout",
  },
  {
    resultLabel: "PAYMENT INFO",
    costLabel: "COST PER PAYMENT INFO",
    pattern: /add\s*payment\s*info|addpaymentinfo/,
    canonicalText: "Add payment info",
  },
  {
    resultLabel: "CONTENT VIEWS",
    costLabel: "COST PER VIEW",
    pattern: /view\s*content|viewcontent/,
    canonicalText: "View content",
  },
  {
    resultLabel: "LANDING PAGE VIEWS",
    costLabel: "COST PER LPV",
    pattern: /landing\s*page\s*views?|\blpv\b/,
    canonicalText: "Landing page view",
  },
  {
    resultLabel: "LINK CLICKS",
    costLabel: "COST PER CLICK",
    pattern: /link\s*clicks?|outbound\s*clicks?/,
    canonicalText: "Link click",
  },
  {
    resultLabel: "APP INSTALLS",
    costLabel: "COST PER INSTALL",
    pattern: /app\s*installs?|mobile\s*app\s*installs?/,
    canonicalText: "App install",
  },
  {
    resultLabel: "REACH",
    costLabel: "COST PER 1K REACH",
    pattern: /\breach\b|people\s*reached/,
    canonicalText: "Reach",
  },
  {
    resultLabel: "IMPRESSIONS",
    costLabel: "CPM",
    pattern: /impressions?|\bcpm\b/,
    canonicalText: "Impression",
  },
  {
    resultLabel: "AD RECALL LIFT",
    costLabel: "COST PER RECALL LIFT",
    pattern: /ad\s*recall|recall\s*lift/,
    canonicalText: "Ad recall",
  },
  {
    resultLabel: "POST ENGAGEMENTS",
    costLabel: "COST PER ENGAGEMENT",
    pattern: /post\s*engagements?|engagements?/,
    canonicalText: "Post engagement",
  },
  {
    resultLabel: "PAGE LIKES",
    costLabel: "COST PER PAGE LIKE",
    pattern: /page\s*likes?/,
    canonicalText: "Page like",
  },
  {
    resultLabel: "FOLLOWERS",
    costLabel: "COST PER FOLLOW",
    pattern: /followers?|\bfollow\b/,
    canonicalText: "Follow",
  },
  {
    resultLabel: "EVENT RESPONSES",
    costLabel: "COST PER RESPONSE",
    pattern: /event\s*responses?/,
    canonicalText: "Event response",
  },
  {
    resultLabel: "VIDEO VIEWS",
    costLabel: "COST PER VIDEO VIEW",
    pattern: /video\s*views?|video\s*plays?|thruplays?/,
    canonicalText: "Video view",
  },
  // Generic fallback for any unmatched lead type — must stay last so every
  // more specific lead bucket above gets first refusal.
  { resultLabel: "LEADS", costLabel: "COST PER LEAD", pattern: /leads?/, canonicalText: "Lead" },
];

/**
 * Step 1 of objective detection — checks result_type text against the full
 * OBJECTIVE_CATALOG dictionary (case-insensitive, partial match). A
 * genuinely blank result_type falls back to the generic RESULTS bucket,
 * which aggregate.ts's Steps 2-4 correction relies on to detect "no result
 * type set" rows. A *present*, unrecognized result_type keeps its own text
 * (cleaned up) instead of being hidden behind a generic label, so a custom
 * or newly-added Meta conversion event still shows its real name.
 */
export function getResultLabels(resultType: string | null | undefined): ResultLabels {
  const rt = (resultType || "").toLowerCase().trim();
  if (!rt) return { resultLabel: "RESULTS", costLabel: "COST PER RESULT" };

  for (const def of OBJECTIVE_CATALOG) {
    if (def.pattern.test(rt)) return { resultLabel: def.resultLabel, costLabel: def.costLabel };
  }

  const cleaned = String(resultType).trim().toUpperCase();
  return { resultLabel: cleaned, costLabel: `COST PER ${cleaned}` };
}

/**
 * Looks up the canonical, guaranteed-round-trippable result_type text for a
 * resultLabel from OBJECTIVE_CATALOG — see its doc comment for why this is
 * necessary. Used by aggregate.ts's Steps 2-4 corrections; falls back to the
 * label itself for any caller-supplied label that isn't in the catalog
 * (defensive only — every label aggregate.ts passes here is one of the
 * catalog's own resultLabel values).
 */
export function canonicalResultTypeText(resultLabel: string): string {
  return OBJECTIVE_CATALOG.find((def) => def.resultLabel === resultLabel)?.canonicalText ?? resultLabel;
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
  if (has("messaging conversations started"))
    return { resultLabel: "MESSAGING LEADS", costLabel: "COST PER CONVERSATION" };
  if (has("whatsapp conversations started"))
    return { resultLabel: "WHATSAPP LEADS", costLabel: "COST PER CONVERSATION" };
  if (has("phone calls") || has("calls")) return { resultLabel: "CALL LEADS", costLabel: "COST PER CALL" };
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
  if (messaging > 0) {
    return { resultLabel: "MESSAGING LEADS", costLabel: "COST PER CONVERSATION", source: "priority1" };
  }
  if (thruplays > 0) {
    return { resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIDEO VIEW", source: "priority1" };
  }

  const rt = getResultLabels(signals.result_type);
  if (rt.resultLabel !== "RESULTS") return { ...rt, source: "resultType" };

  if (columnObjective) return { ...columnObjective, source: "priority3" };

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
  const rawHeaders = rows.length > 0 ? Object.keys(rows[0]._raw || {}) : [];
  const columnObjective = detectObjectiveFromColumns(rawHeaders);

  rows.forEach((row) => {
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
        initiate_checkout: sumRawColumnByKeywords(row._raw, ["initiate checkout"]),
        add_to_cart: sumRawColumnByKeywords(row._raw, ["adds to cart", "add to cart"]),
        ad_set_name: row.ad_set_name,
      },
      columnObjective,
    );
    if (!groups[label]) groups[label] = { costLabel: cost, count: 0, totalSpend: 0, totalReach: 0 };
    groups[label].count += parseCellNum(row.results);
    groups[label].totalSpend += parseCellNum(row.spend);
    groups[label].totalReach += parseCellNum(row.reach);
  });

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

/**
 * Objective-detection rebuild — Layer 2's own per-campaign resolver, the
 * ONE deterministic pipeline every campaign-level objective consumer reads
 * from: campaign/ad-set slides, the Combined Total table (via
 * buildCampaignObjectiveMap → groupResultsByCampaignObjective below), and
 * the wizard's Objective Confirmation step (via
 * buildCampaignObjectiveMapWithConfidence). Replaces the OLD competing
 * per-campaign chain (an explicit purchase/initiate-checkout text set, a
 * dominant-result-type-must-outnumber-blanks check, a landing_page_view
 * special case, and a closest-to-Results funnel tie-break) with a single
 * fixed step order, run once per campaign, using ONLY that campaign's own
 * rows.
 *
 * This does NOT touch resolveObjective/detectObjectiveFromColumns/
 * getResultGroups/OBJECTIVE_CATALOG above — health.ts's account health
 * score and aggregate.ts's row-level AggRow.result_type computation both
 * depend on their exact existing behavior and are explicitly out of scope
 * for this rebuild; those functions keep running, just for a different
 * purpose (row-level signals only, never a campaign's own final objective
 * anymore).
 *
 * Step 1 — a cached objective (the Objective Confirmation memory cache,
 * objective-cache.ts) wins outright: a user already confirmed this exact
 * campaign on a prior report, the single most reliable signal there is.
 * The caller does its own name→cache lookup and passes the result in —
 * this function stays name-agnostic.
 *
 * Step 2 — result_type ground truth: this campaign's own DOMINANT
 * non-blank result_type value (most rows win — a campaign can, in
 * principle, carry more than one distinct value if the objective genuinely
 * changed mid-flight), looked up in result-type-map.ts's RESULT_TYPE_MAP
 * for an EXACT match against Meta's own machine-readable event names. This
 * is Meta's own declaration of what the campaign is optimized for — ground
 * truth, and it wins even when some OTHER column (e.g. an incidental
 * Purchases count on a genuine Reach campaign) might otherwise look like a
 * signal. A dominant value with no RESULT_TYPE_MAP entry (unrecognized/
 * custom event text) falls through below, same as no dominant value at
 * all.
 *
 * Step 3 — blank result_type fallback, ONLY when EVERY row's result_type
 * is blank: the Meta-form-leads-vs-website-leads decision tree, reading
 * ONLY this campaign's own dedicated columns — never whole-file column
 * presence, never campaign/ad-set name, never "whichever count is bigger"
 * as a tie-break. Exactly one lead type present picks that objective
 * (confidence "low" — an inference, not text Meta wrote down); BOTH
 * present is a genuine, unresolvable ambiguity, returned as generic LEADS
 * with requiresConfirmation so the wizard forces a human decision; BOTH
 * zero means this pair simply has nothing to say (not an ambiguity to
 * report), so it falls through to Step 4 instead of guessing.
 *
 * Step 4 — other objectives, by this campaign's own row totals for each
 * dedicated column, only reached once Steps 2-3 found nothing to trust.
 *
 * Step 5 — Reach, the last resort before giving up entirely.
 *
 * Step 6 — the generic RESULTS bucket (confidence "low",
 * requiresConfirmation) — a campaign with no reliable signal of any kind.
 */
export type ObjectiveConfidenceTier = "high" | "medium" | "low" | "verify";

export interface CampaignObjectiveResolution extends ResultLabels {
  /** OBJECTIVE_CARD_PACKS' own lookup key (slot-assignment.ts) — Layer 3 reads this directly, never re-derives it from resultLabel text. */
  key: string;
  confidence: ObjectiveConfidenceTier;
  /** True when this campaign's objective is a genuine guess a user must actively confirm (the blank-result_type "both lead types present" case, and the Step 6 generic fallback) — the wizard's Objective Confirmation step blocks Continue for any selected campaign still in this state. */
  requiresConfirmation: boolean;
}

/** Backward-compatible alias — every existing caller of the wizard's "high"/"low" confidence badge type keeps working; new callers should prefer CampaignObjectiveResolution's wider tier set directly. */
export type ObjectiveConfidence = CampaignObjectiveResolution;

function makeResolution(
  key: string,
  resultLabel: string,
  costLabel: string,
  confidence: ObjectiveConfidenceTier,
  requiresConfirmation: boolean,
): CampaignObjectiveResolution {
  return { key, resultLabel, costLabel, confidence, requiresConfirmation };
}

/** Sums a campaign's own rows for a MetricRow field with a dedicated numeric/string value — never whole-file column presence. */
function sumMetricField(rows: MetricRow[], field: "purchases" | "website_leads" | "meta_form_leads" | "link_clicks" | "landing_page_views" | "reach"): number {
  return rows.reduce((sum, r) => sum + parseCellNum(r[field]), 0);
}

/** Same as sumMetricField, for a signal with no dedicated MetricRow field (video views/thruplays, app installs, messaging) — summed straight from each row's own raw CSV columns, the same "exotic signal" treatment sumRawColumnByKeywords already gives these elsewhere in this file (aggregate.ts, getResultGroups above). */
function sumRawKeywordsAcrossRows(rows: MetricRow[], keywords: string[]): number {
  return rows.reduce((sum, r) => sum + sumRawColumnByKeywords(r._raw, keywords), 0);
}

/** Defensive fallback key for a cached objective passed in without its own `key` (Step 1) — every real CachedObjective (objective-cache.ts) always carries one, so this only ever matters for a bare ResultLabels test fixture. */
function slugifyResultLabel(resultLabel: string): string {
  return resultLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** RESULT_TYPE_MAP's own key for a resultLabel it already recognizes (reverse lookup, for Step 2's fuzzy-text fallback below), else a slugified fallback. */
function keyForResultLabel(resultLabel: string): string {
  for (const info of Object.values(RESULT_TYPE_MAP)) {
    if (info.resultLabel === resultLabel) return info.key;
  }
  return slugifyResultLabel(resultLabel);
}

/** This campaign's own dominant (most common) non-blank result_type value, or null if every row's result_type is blank. */
/**
 * Step 2's own text-signal resolution — every distinct non-blank
 * result_type value across this campaign's rows, matched EITHER against
 * RESULT_TYPE_MAP (exact, Meta's own machine-readable ground truth) or the
 * fuzzy OBJECTIVE_CATALOG fallback (see resolveCampaignObjective's own Step
 * 2 doc comment for why both are needed). An exact match always outranks a
 * fuzzy-only one, even when the fuzzy-only value happens to have a higher
 * row count — real machine text is a stronger signal than an inferred
 * fuzzy match, never just "whichever text shows up more often". Ties
 * within the same tier go to whichever value is more common. Returns null
 * only when every row's result_type is blank, or none of the non-blank
 * values matches anything at all.
 */
function resolveTextObjective(rows: MetricRow[]): CampaignObjectiveResolution | null {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rt = (row.result_type || "").toLowerCase().trim();
    if (rt) counts.set(rt, (counts.get(rt) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let bestExact: { count: number; info: ObjectiveInfo } | null = null;
  let bestFuzzy: { count: number; labels: ResultLabels } | null = null;
  for (const [text, count] of counts) {
    const exact = resolveObjectiveFromResultType(text);
    if (exact) {
      if (!bestExact || count > bestExact.count) bestExact = { count, info: exact };
      continue;
    }
    const fuzzy = getResultLabels(text);
    if (fuzzy.resultLabel !== "RESULTS" && (!bestFuzzy || count > bestFuzzy.count)) {
      bestFuzzy = { count, labels: fuzzy };
    }
  }

  if (bestExact) {
    return makeResolution(bestExact.info.key, bestExact.info.resultLabel, bestExact.info.costLabel, "high", false);
  }
  if (bestFuzzy) {
    return makeResolution(keyForResultLabel(bestFuzzy.labels.resultLabel), bestFuzzy.labels.resultLabel, bestFuzzy.labels.costLabel, "high", false);
  }
  return null;
}

/**
 * Layer 2's pipeline entry point — see the doc comment above for the full
 * step-by-step rationale. `campaignName` is accepted for API-shape parity
 * with the spec (e.g. future logging) but is never itself a detection
 * signal, per Step 3's own "never use campaign/ad-set name" rule.
 * `cachedObjective` is the CALLER's own already-resolved cache lookup for
 * this specific campaign (objective-cache.ts's lookupCachedObjective) —
 * this function does no cache lookup of its own.
 */
export function resolveCampaignObjective(
  campaignRows: MetricRow[],
  campaignName?: string,
  cachedObjective?: (ResultLabels & { key?: string }) | null,
): CampaignObjectiveResolution {
  void campaignName;

  // Step 1 — cached objective wins outright.
  if (cachedObjective) {
    return makeResolution(
      cachedObjective.key ?? slugifyResultLabel(cachedObjective.resultLabel),
      cachedObjective.resultLabel,
      cachedObjective.costLabel,
      "high",
      false,
    );
  }

  // Step 2 — result_type ground truth (resolveTextObjective above): an
  // EXACT RESULT_TYPE_MAP match always outranks a merely fuzzy-matched
  // one, even when the fuzzy-only value has a higher row count — real
  // machine text is a stronger signal than an inferred fuzzy match. The
  // fuzzy fallback itself is needed because aggregate.ts (unchanged, out
  // of scope for this rebuild) still writes ITS OWN synthetic
  // canonicalResultTypeText result_type back onto an already-aggregated
  // AggRow whenever ITS OWN column-presence/data-value chain resolved the
  // objective (e.g. "Meta lead" for META FORM LEADS) — this pipeline must
  // still recognize that text as real ground truth when reading AggRow
  // input, not just a fresh raw NreRow. Still purely TEXT-based either
  // way — never column presence, never a value comparison.
  const textObjective = resolveTextObjective(campaignRows);
  if (textObjective) return textObjective;

  // Step 3 — blank result_type fallback (only when EVERY row is blank).
  const allBlank = campaignRows.every((r) => !(r.result_type || "").toString().trim());
  if (allBlank) {
    const formLeads = sumMetricField(campaignRows, "meta_form_leads");
    const websiteLeads = sumMetricField(campaignRows, "website_leads");
    if (formLeads > 0 && websiteLeads === 0) {
      return makeResolution("meta_form_leads", "META FORM LEADS", "COST PER LEAD", "low", false);
    }
    if (websiteLeads > 0 && formLeads === 0) {
      return makeResolution("website_leads", "WEBSITE LEADS", "COST PER WEBSITE LEAD", "low", false);
    }
    if (formLeads > 0 && websiteLeads > 0) {
      return makeResolution("leads", "LEADS", "COST PER LEAD", "verify", true);
    }
    // Both zero — no ambiguity to report, just no signal from this specific
    // pair. Falls through to Step 4 rather than guessing.
  }

  // Step 4 — other objectives, by this campaign's own row totals.
  const purchases = sumMetricField(campaignRows, "purchases");
  if (purchases > 0) return makeResolution("purchases", "PURCHASES", "COST PER PURCHASE", "medium", false);

  const videoViews =
    sumRawKeywordsAcrossRows(campaignRows, ["thruplay"]) ||
    sumRawKeywordsAcrossRows(campaignRows, ["video play", "video view"]);
  if (videoViews > 0) return makeResolution("video_views", "THRUPLAYS", "COST PER THRUPLAY", "medium", false);

  const appInstalls = sumRawKeywordsAcrossRows(campaignRows, ["mobile app install", "app install"]);
  if (appInstalls > 0) return makeResolution("app_installs", "APP INSTALLS", "COST PER INSTALL", "medium", false);

  const messagingConversations = sumRawKeywordsAcrossRows(campaignRows, ["messaging conversations started"]);
  if (messagingConversations > 0) {
    return makeResolution("messaging", "CONVERSATIONS", "COST PER CONVERSATION", "medium", false);
  }

  const linkClicks = sumMetricField(campaignRows, "link_clicks");
  const landingPageViews = sumMetricField(campaignRows, "landing_page_views");
  if (linkClicks > 0 && landingPageViews === 0) {
    return makeResolution("link_clicks", "LINK CLICKS", "COST PER CLICK", "medium", false);
  }
  if (landingPageViews > 0) {
    return makeResolution("landing_page_views", "LANDING PAGE VIEWS", "COST PER LPV", "medium", false);
  }

  // Step 5 — Reach, last resort before giving up.
  const reach = sumMetricField(campaignRows, "reach");
  if (reach > 0) return makeResolution("reach", "REACH", "COST PER 1K REACH", "medium", false);

  // Step 6 — generic fallback.
  return makeResolution("results", "RESULTS", "COST PER RESULT", "low", true);
}

/** ResultLabels-only view of resolveCampaignObjective, for every call site that only needs {resultLabel, costLabel} (the overwhelming majority — report generation itself never reads confidence/requiresConfirmation, only the wizard's own display layer does). */
export function resolveCampaignObjectiveLabelsOnly(
  campaignRows: MetricRow[],
  campaignName?: string,
  cachedObjective?: (ResultLabels & { key?: string }) | null,
): ResultLabels {
  const { resultLabel, costLabel } = resolveCampaignObjective(campaignRows, campaignName, cachedObjective);
  return { resultLabel, costLabel };
}

/** Objective Confirmation memory cache — same detection as resolveCampaignObjective, explicit alias kept for every existing "WithConfidence" call site (the wizard's own /metrics route). */
export function resolveCampaignObjectiveWithConfidence(
  campaignRows: MetricRow[],
  campaignName?: string,
  cachedObjective?: (ResultLabels & { key?: string }) | null,
): CampaignObjectiveResolution {
  return resolveCampaignObjective(campaignRows, campaignName, cachedObjective);
}

/**
 * campaignObjectiveMap builder — every campaign-level objective consumer
 * (campaign/ad-set slides, the Combined Total table via
 * groupResultsByCampaignObjective below) reads from ONE map built here, so
 * they're guaranteed to agree. `cachedObjectives`, when passed, is
 * consulted per-campaign as Step 1 above (keyed by the SAME
 * normalizeCampaignName convention this map itself uses) — omit it for a
 * call site with no cache concept (e.g. Previous Month Data, Comparison
 * Reports), which then just runs Steps 2-6 for every campaign.
 */
export function buildCampaignObjectiveMap(
  rows: MetricRow[],
  cachedObjectives?: Map<string, ResultLabels & { key?: string }>,
): Map<string, ResultLabels> {
  const map = new Map<string, ResultLabels>();
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    map.set(name, resolveCampaignObjectiveLabelsOnly(campRows, name, cachedObjectives?.get(name) ?? null));
  });
  return map;
}

/** buildCampaignObjectiveMap's confidence-carrying counterpart, for the wizard's own /metrics route (the only consumer that needs the confidence/requiresConfirmation badge; every other buildCampaignObjectiveMap call site is unaffected). */
export function buildCampaignObjectiveMapWithConfidence(
  rows: MetricRow[],
  cachedObjectives?: Map<string, ResultLabels & { key?: string }>,
): Map<string, CampaignObjectiveResolution> {
  const map = new Map<string, CampaignObjectiveResolution>();
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    map.set(name, resolveCampaignObjectiveWithConfidence(campRows, name, cachedObjectives?.get(name) ?? null));
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
    return parseCellNum(row.results);
  }
  if (label === "PURCHASES") return parseCellNum(row.purchases);
  if (label === "INITIATE CHECKOUT") return rowInitiateCheckout(row);
  if (label === "ADD TO CART") return rowAddToCart(row);
  // No dedicated field tracks any other objective (Leads, Reach, ...) on a
  // mismatched row — it contributes nothing to a bucket it has no real
  // metric for, rather than reusing `results`, which measures something
  // else entirely for this specific row.
  return 0;
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
    campRows.forEach((row) => {
      const value = resultValueForObjective(row, label);
      groups[label].count += value;
      groups[label].totalSpend += parseCellNum(row.spend);
      groups[label].totalReach += parseCellNum(row.reach);
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
  campRows.forEach((row) => {
    count += resultValueForObjective(row, objective.resultLabel);
    totalSpend += parseCellNum(row.spend);
    totalReach += parseCellNum(row.reach);
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
