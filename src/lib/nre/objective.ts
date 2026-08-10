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

  rows.forEach((row) => {
    const { resultLabel: label, costLabel: cost } = getResultLabels(row.result_type || "");
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
