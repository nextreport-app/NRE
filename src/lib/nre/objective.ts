/**
 * NRE v1 — result-type / objective label detection.
 * Direct port of getResultLabels_ / getResultGroups_ / getGroupedResultDisplay_ /
 * getSingleRowResultDisplay_ from meta_ads_report_v4.js.
 *
 * Note: the Apps Script source also defines detectObjectiveFromData_, but it is
 * never called anywhere in generateWeeklyReport() — the live data-first
 * objective correction lives inside aggregate() (see aggregate.ts). That dead
 * function is intentionally not ported.
 */

import { parseCellNum, fmtNumber, fmtCurrency2dp } from "./format";
import type { MetricRow } from "./types";
import type { AggRow } from "./aggregate";

export interface ResultLabels {
  resultLabel: string;
  costLabel: string;
}

/**
 * Port of getResultLabels_ — comprehensive regex-based objective detection,
 * extended with Meta's common website-conversion-event names (per product
 * owner, from testing against real accounts).
 *
 * Order matters: specific, known objective/event strings are checked first
 * so a distinct objective never collapses into a broader bucket's generic
 * label — e.g. "Leads (form)" must stay "LEADS (FORM)" rather than the
 * generic "LEADS" the lead|form bucket below would produce, and "Submit
 * application" must stay "APPLICATIONS" rather than being caught by the
 * app-install bucket's "app" substring match.
 */
export function getResultLabels(resultType: string | null | undefined): ResultLabels {
  const rt = (resultType || "").toLowerCase().trim();

  if (/leads?\s*\(\s*form\s*\)/.test(rt))
    return { resultLabel: "LEADS (FORM)", costLabel: "COST PER LEAD" };

  // Checked before the generic lead|form bucket further below, same
  // reasoning as "Leads (form)" above — a distinct, named lead objective
  // must keep its own label rather than collapsing into generic "LEADS".
  if (/website\s*leads?/.test(rt))
    return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };

  if (/meta\s*leads?/.test(rt))
    return { resultLabel: "META LEADS", costLabel: "COST PER META LEAD" };

  if (/quote request/.test(rt))
    return { resultLabel: "QUOTE REQUESTS", costLabel: "COST PER QUOTE REQUEST" };

  if (/subscri/.test(rt))
    return { resultLabel: "WEBSITE SUBSCRIPTIONS", costLabel: "COST PER SUBSCRIPTION" };

  if (/contact/.test(rt)) return { resultLabel: "CONTACTS", costLabel: "COST PER CONTACT" };

  if (/schedule/.test(rt)) return { resultLabel: "APPOINTMENTS", costLabel: "COST PER APPOINTMENT" };

  if (/find location|store visit/.test(rt))
    return { resultLabel: "STORE VISITS", costLabel: "COST PER VISIT" };

  if (/complete registration/.test(rt))
    return { resultLabel: "REGISTRATIONS", costLabel: "COST PER REGISTRATION" };

  if (/submit application/.test(rt))
    return { resultLabel: "APPLICATIONS", costLabel: "COST PER APPLICATION" };

  if (/start trial/.test(rt)) return { resultLabel: "TRIALS", costLabel: "COST PER TRIAL" };

  if (/donat/.test(rt)) return { resultLabel: "DONATIONS", costLabel: "COST PER DONATION" };

  if (/purchase|buy|checkout|transaction|order|sale/.test(rt))
    return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };

  if (/lead|form|sign.?up|registration/.test(rt))
    return { resultLabel: "LEADS", costLabel: "COST PER LEAD" };

  if (/landing.?page|lpv|page.?view/.test(rt))
    return { resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV" };

  if (/link.?click|outbound|click/.test(rt))
    return { resultLabel: "CLICKS", costLabel: "COST PER CLICK" };

  if (/reach|awareness|impression/.test(rt))
    return { resultLabel: "REACH", costLabel: "COST PER 1K REACH" };

  if (/video|view|watch|thruplay/.test(rt))
    return { resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIEW" };

  if (/app|install|mobile/.test(rt))
    return { resultLabel: "APP INSTALLS", costLabel: "COST PER INSTALL" };

  if (/conv|action/.test(rt)) return { resultLabel: "CONVERSIONS", costLabel: "COST PER CONV" };

  // Last resort: a genuinely blank result_type (common on rows Meta didn't
  // populate) still falls back to the generic RESULTS bucket — aggregate.ts's
  // data-first objective correction relies on that to detect "no result type
  // set" rows. But an unrecognized-and-non-empty result_type keeps its own
  // text (cleaned up) instead of being hidden behind a generic label, so a
  // custom or newly-added Meta conversion event still shows its real name.
  if (rt) {
    const cleaned = String(resultType).trim().toUpperCase();
    return { resultLabel: cleaned, costLabel: `COST PER ${cleaned}` };
  }
  return { resultLabel: "RESULTS", costLabel: "COST PER RESULT" };
}

/**
 * Column-presence objective detection — priority 2, above data-value-based
 * fallbacks (see aggregate.ts's DATA-FIRST correction) but below explicit
 * result_type text (priority 1, getResultLabels above).
 *
 * Real-account bug: a brand new "Website Leads" campaign with zero leads so
 * far has an empty result_type and a zero-valued "Website leads" column —
 * but Meta always populates "Link clicks" regardless of objective, so a
 * value-based fallback wrongly detects Clicks/Traffic. An agency only
 * includes an objective-specific column (Website leads, Purchases, ...) in
 * their export when that's their actual campaign objective, so the column
 * merely EXISTING — regardless of whether it has any values yet — is a far
 * more reliable signal than which columns happen to be non-zero.
 *
 * Checked most-specific-first, same reasoning as getResultLabels: "Website
 * leads"/"Meta leads" must be checked before the generic "lead" substring
 * would otherwise catch them.
 */
export function detectObjectiveFromColumns(headers: (string | null | undefined)[]): ResultLabels | null {
  const normalized = headers.map((h) => (h || "").toLowerCase().trim());
  const has = (substr: string) => normalized.some((h) => h.includes(substr));

  if (has("website lead")) return { resultLabel: "WEBSITE LEADS", costLabel: "COST PER WEBSITE LEAD" };
  if (has("meta lead")) return { resultLabel: "META LEADS", costLabel: "COST PER META LEAD" };
  if (has("lead")) return { resultLabel: "LEADS", costLabel: "COST PER LEAD" };
  // "Purchase ROAS" contains "purchase" too, so a single check covers both.
  if (has("purchase")) return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };
  // The "AND Website leads column does NOT exist" half of this rule is
  // automatically satisfied by reaching this point — that check already
  // returned above if a Website leads column exists.
  if (has("landing page view")) return { resultLabel: "LANDING PAGE VIEWS", costLabel: "COST PER LPV" };
  if (has("video play") || has("thruplay")) return { resultLabel: "VIDEO VIEWS", costLabel: "COST PER VIEW" };
  return null;
}

export interface ResultGroup {
  label: string;
  costLabel: string;
  count: number;
  avgCpr: number;
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
      return { label, costLabel: g.costLabel, count: g.count, avgCpr: adjCpr };
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
