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

/** Port of getResultLabels_ — comprehensive regex-based objective detection. */
export function getResultLabels(resultType: string | null | undefined): ResultLabels {
  const rt = (resultType || "").toLowerCase().trim();

  if (/purchase|buy|checkout|transaction|order|sale/.test(rt))
    return { resultLabel: "PURCHASES", costLabel: "COST PER PURCHASE" };

  if (/lead|form|sign.?up|registration|subscribe/.test(rt))
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

  return { resultLabel: "RESULTS", costLabel: "COST PER RESULT" };
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
