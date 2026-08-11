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
  if (purchases > 0) {
    return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE", source: "priority1" };
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
 */
export function getResultGroups(rows: MetricRow[]): ResultGroup[] {
  const groups: Record<string, { costLabel: string; count: number; totalSpend: number; totalReach: number }> = {};

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
      },
      columnObjective,
    );
    if (!groups[label]) groups[label] = { costLabel: cost, count: 0, totalSpend: 0, totalReach: 0 };
    groups[label].count += parseCellNum(row.results);
    groups[label].totalSpend += parseCellNum(row.spend);
    groups[label].totalReach += parseCellNum(row.reach);
  });

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
