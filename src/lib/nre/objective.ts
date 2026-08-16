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
import { resolveObjectiveFromResultType } from "./result-type-map";

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
/**
 * Purchase-variant result_type text (Part 7 bug fix) — every human-readable
 * and machine-readable spelling Meta writes into result_type for a real
 * purchase conversion. Matched with an EXACT (not fuzzy/substring) equality
 * check after lower-casing/trimming, since resolveCampaignObjective below
 * treats even a single occurrence anywhere in a campaign's rows as
 * definitive proof — a loose/fuzzy match here would risk false-positives on
 * unrelated text.
 */
const PURCHASE_RESULT_TYPE_TEXTS = new Set([
  "purchase",
  "purchases",
  "website purchase",
  "website purchases",
  "offsite_conversion.fb_pixel_purchase",
  "onsite_web_purchase",
  "product_catalog_sales",
]);

/** Initiate-Checkout-variant result_type text — see PURCHASE_RESULT_TYPE_TEXTS' doc comment; same exact-match reasoning. */
const INITIATE_CHECKOUT_RESULT_TYPE_TEXTS = new Set([
  "initiate_checkout",
  "initiate checkout",
  "checkouts initiated",
  "offsite_conversion.fb_pixel_initiate_checkout",
  "onsite_web_initiate_checkout",
]);

function isPurchaseResultTypeText(resultType: string | null | undefined): boolean {
  const rt = (resultType || "").toLowerCase().trim();
  return rt !== "" && PURCHASE_RESULT_TYPE_TEXTS.has(rt);
}

function isInitiateCheckoutResultTypeText(resultType: string | null | undefined): boolean {
  const rt = (resultType || "").toLowerCase().trim();
  return rt !== "" && INITIATE_CHECKOUT_RESULT_TYPE_TEXTS.has(rt);
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
export function resolveCampaignObjective(rows: MetricRow[]): ResultLabels {
  if (rows.some((r) => isPurchaseResultTypeText(r.result_type))) {
    return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };
  }
  if (rows.some((r) => isInitiateCheckoutResultTypeText(r.result_type))) {
    return { resultLabel: "INITIATE CHECKOUT", costLabel: "COST PER CHECKOUT" };
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
    if (!isLandingPageViewSpecialCase || !hasRealLeadsColumnData) {
      const info = resolveObjectiveFromResultType(dominantResultType);
      if (info) return { resultLabel: info.resultLabel, costLabel: info.costLabel };
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
      return { resultLabel: best.resultLabel, costLabel: best.costLabel };
    }
  }

  const primary = pickPrimaryResultGroup(getResultGroups(rows));
  return { resultLabel: primary?.label ?? "RESULTS", costLabel: primary?.costLabel ?? "COST PER RESULT" };
}

export function buildCampaignObjectiveMap(rows: MetricRow[]): Map<string, ResultLabels> {
  const map = new Map<string, ResultLabels>();
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    map.set(name, resolveCampaignObjective(campRows));
  });
  return map;
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
 */
export function groupResultsByCampaignObjective(rows: MetricRow[], objectiveMap: Map<string, ResultLabels>): ResultGroup[] {
  const groups: Record<string, ObjectiveBucket> = {};
  Object.entries(groupRowsByCampaign(rows)).forEach(([name, campRows]) => {
    const objective = objectiveMap.get(name) ?? { resultLabel: "RESULTS", costLabel: "COST PER RESULT" };
    const label = objective.resultLabel;
    if (!groups[label]) groups[label] = { costLabel: objective.costLabel, count: 0, totalSpend: 0, totalReach: 0 };
    campRows.forEach((row) => {
      groups[label].count += parseCellNum(row.results);
      groups[label].totalSpend += parseCellNum(row.spend);
      groups[label].totalReach += parseCellNum(row.reach);
    });
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
  let count = 0;
  let totalSpend = 0;
  let totalReach = 0;
  campRows.forEach((row) => {
    count += parseCellNum(row.results);
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
 * the Combined Total table. The row's own results/cpr numbers are used
 * as-is (unchanged) — only the label is forced to match the campaign's
 * official objective.
 */
export function getSingleRowResultDisplayForObjective(row: AggRow, objective: ResultLabels, currencySymbol: string): ResultDisplay {
  const results = parseCellNum(row.results);
  const cpr = parseCellNum(row.cpr);
  return {
    resultLabel: objective.resultLabel,
    costLabel: objective.costLabel,
    resultValue: results > 0 ? fmtNumber(results) : "0",
    cprValue: cpr > 0 ? fmtCurrency2dp(cpr, currencySymbol) : "—",
  };
}
