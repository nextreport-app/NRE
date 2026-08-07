/**
 * NRE v1 — Account Health Score + budget summary.
 * Originally a direct port of calculateAccountHealth_ / fillCoverExtras_ from
 * meta_ads_report_v4.js; the base four-component structure (results
 * delivery, CTR engagement, audience frequency, cost efficiency) and its
 * point weights are still that port, but the scoring itself has since been
 * extended (product owner spec) to penalize an underperforming PRIMARY
 * OBJECTIVE specifically, instead of blending every campaign's numbers
 * together with no regard for what "good" means for that particular
 * objective — see calculateAccountHealth's own comments below for the
 * concrete rules.
 *
 * The original also threaded a week-over-week (WoW) comparison through this
 * function, but the WoW data source was removed upstream (`var prev = null;
 * // WoW removed`), so `hasWoW` was always false and every WoW-guarded branch
 * was dead code. That's simplified away here to its always-taken branch —
 * the resulting score and thresholds (apart from the new objective-specific
 * rules) are bit-for-bit identical to the original's actual (tested)
 * behaviour.
 *
 * One intentional deviation: the original's budget line hardcodes '$'
 * regardless of the account's CURRENCY_SYMBOL config (a single-currency
 * script whose only tested account used USD). NextReport is multi-currency
 * per client, so the client's actual currency symbol is used here instead —
 * the budget math itself (spend / budget %, days remaining) is unchanged.
 */

import { parseCellNum } from "./format";
import { getResultGroups } from "./objective";
import type { AggRow } from "./aggregate";

export interface AccountHealth {
  score: number;
  badge: string;
}

// ── Objective-specific score caps (product owner spec) ──────────────────
// This is a single WHOLE-ACCOUNT health score, not per-campaign — a mixed-
// objective account is judged against whichever objective produced the most
// results this week (dominantObjective below), the same "one blended score"
// simplification the rest of this function already makes.
const PURCHASE_ZERO_RESULTS_MIN_SPEND = 50;
const PURCHASE_EARLY_RESULTS_MAX = 2; // 1-2 purchases counts as "very early"
const PURCHASE_EARLY_RESULTS_MIN_SPEND = 100;
const PURCHASE_EARLY_RESULTS_SCORE_CAP = 15;
// "3x the industry average" — $50 is the spec's own rough CPA benchmark for
// purchase campaigns, not a config value (no such benchmark exists elsewhere
// in this app, which has no per-vertical or per-region CPA data at all).
const PURCHASE_CPA_BENCHMARK = 50;
const PURCHASE_CPA_MULTIPLIER = 3;
const PURCHASE_COST_SCORE_CAP = 10;

const LEAD_ZERO_RESULTS_MIN_SPEND = 30;
const LEAD_CPL_THRESHOLD = 50;
const LEAD_COST_SCORE_CAP = 10;
const LEAD_OBJECTIVE_LABELS = new Set(["LEADS", "WEBSITE LEADS", "META FORM LEADS"]);

const TRAFFIC_LOW_CTR = 0.5;
const TRAFFIC_MID_CTR = 1.0;
const TRAFFIC_MID_CTR_SCORE_CAP = 10;
// objective.ts's OBJECTIVE_CATALOG resultLabel values for "Clicks"/"LPV".
const TRAFFIC_OBJECTIVE_LABELS = new Set(["LINK CLICKS", "LANDING PAGE VIEWS"]);

const LEARNING_PHASE_MIN_SPEND = 50;
const LEARNING_PHASE_MIN_RESULTS = 3;
const LEARNING_PHASE_SCORE_CAP = 65;
const LEARNING_PHASE_BADGE = "🟡 Campaign in Learning Phase — optimising delivery";

/**
 * Port of calculateAccountHealth_, extended with the objective-specific
 * rules above. `periodLabel` (Fix 8 — Monthly Report option) only affects
 * the badge's own wording ("Weekly Performance Score" -> "Monthly
 * Performance Score", "this week" -> "this month") — none of the scoring
 * math below changes; `weeklyRows` is exactly the rows the badge describes,
 * whichever window the caller actually built it from (see report-data.ts's
 * primaryRows).
 */
export function calculateAccountHealth(weeklyRows: AggRow[], periodLabel: "Weekly" | "Monthly" = "Weekly"): AccountHealth {
  const periodWord = periodLabel === "Weekly" ? "week" : "month";

  if (!weeklyRows || weeklyRows.length === 0) {
    return { score: 0, badge: "⚙️ Active Optimization Phase — improvements underway" };
  }

  let totalResults = 0;
  let totalSpend = 0;
  const ctrs: number[] = [];
  const freqs: number[] = [];

  weeklyRows.forEach((row) => {
    totalResults += parseCellNum(row.results);
    totalSpend += parseCellNum(row.spend);
    const ctr = parseCellNum(row.ctr);
    if (ctr > 0) ctrs.push(ctr);
    const freq =
      parseCellNum(row.frequency) ||
      (parseCellNum(row.reach) > 0 ? parseCellNum(row.impressions) / parseCellNum(row.reach) : 0);
    if (freq > 0) freqs.push(freq);
  });

  const avgCtr = ctrs.length ? ctrs.reduce((a, b) => a + b, 0) / ctrs.length : 0;
  const avgFreq = freqs.length ? freqs.reduce((a, b) => a + b, 0) / freqs.length : 0;
  // Cost per result for the dominant objective — "CPA is available" in the
  // spec's Purchase rule just means totalResults > 0 (can't divide by zero
  // results); 0 here reads as "not available", which never exceeds either
  // cost-efficiency threshold below, so it never wrongly triggers those caps.
  const avgCostPerResult = totalResults > 0 ? totalSpend / totalResults : 0;

  // The highest-count result group this week — same detection objective.ts
  // already uses everywhere else (getResultGroups), reused here rather than
  // re-deriving objective matching logic a second time in this file.
  const dominantObjective = getResultGroups(weeklyRows)[0]?.label ?? null;

  let score = 0;

  // 1. Results delivery (35 pts) — no WoW source, so the baseline is always
  //    the "has results, no comparison" branch (25 pts) or the zero-results
  //    floor (5 pts); the objective-specific rules below can only ever LOWER
  //    that baseline (cap it), never raise it above 25.
  let resultsScore = totalResults > 0 ? 25 : 5;
  if (dominantObjective === "PURCHASES") {
    if (totalResults === 0 && totalSpend > PURCHASE_ZERO_RESULTS_MIN_SPEND) {
      resultsScore = 0; // spending but not converting at all
    } else if (totalResults > 0 && totalResults <= PURCHASE_EARLY_RESULTS_MAX && totalSpend > PURCHASE_EARLY_RESULTS_MIN_SPEND) {
      resultsScore = Math.min(resultsScore, PURCHASE_EARLY_RESULTS_SCORE_CAP); // very early, insufficient data
    }
  } else if (dominantObjective && LEAD_OBJECTIVE_LABELS.has(dominantObjective)) {
    if (totalResults === 0 && totalSpend > LEAD_ZERO_RESULTS_MIN_SPEND) {
      resultsScore = 0;
    }
  }
  score += resultsScore;

  // 2. CTR engagement (25 pts)
  let ctrScore = 0;
  if (avgCtr >= 3.0) ctrScore = 25;
  else if (avgCtr >= 2.0) ctrScore = 20;
  else if (avgCtr >= 1.0) ctrScore = 13;
  else if (avgCtr >= 0.5) ctrScore = 6;
  else if (avgCtr > 0) ctrScore = 2;
  if (dominantObjective && TRAFFIC_OBJECTIVE_LABELS.has(dominantObjective)) {
    if (avgCtr < TRAFFIC_LOW_CTR) ctrScore = 0;
    else if (avgCtr < TRAFFIC_MID_CTR) ctrScore = Math.min(ctrScore, TRAFFIC_MID_CTR_SCORE_CAP);
  }
  score += ctrScore;

  // 3. Audience frequency health (20 pts) — objective-agnostic, unchanged.
  if (avgFreq === 0) score += 14; // no frequency data — neutral
  else if (avgFreq < 2.0) score += 20;
  else if (avgFreq < 2.5) score += 17;
  else if (avgFreq < 3.5) score += 12;
  else if (avgFreq < 5.0) score += 5;
  // else freq >= 5 → 0 pts

  // 4. Cost efficiency (20 pts) — no WoW source, so the baseline is always
  //    the flat neutral 12; the objective-specific CPA/CPL rules can only
  //    lower that, same shape as the results-delivery caps above.
  let costScore = 12;
  if (dominantObjective === "PURCHASES" && avgCostPerResult > PURCHASE_CPA_BENCHMARK * PURCHASE_CPA_MULTIPLIER) {
    costScore = Math.min(costScore, PURCHASE_COST_SCORE_CAP);
  } else if (dominantObjective && LEAD_OBJECTIVE_LABELS.has(dominantObjective) && avgCostPerResult > LEAD_CPL_THRESHOLD) {
    costScore = Math.min(costScore, LEAD_COST_SCORE_CAP);
  }
  score += costScore;

  score = Math.min(100, Math.max(0, score));

  // Learning phase overrides everything above: applies to every objective
  // alike, caps the stored score, and replaces the badge text entirely with
  // no "X/100" in it — the number itself isn't meaningful yet this early.
  if (totalSpend < LEARNING_PHASE_MIN_SPEND || totalResults < LEARNING_PHASE_MIN_RESULTS) {
    return { score: Math.min(score, LEARNING_PHASE_SCORE_CAP), badge: LEARNING_PHASE_BADGE };
  }

  let badge: string;
  if (score >= 80 && totalResults > 5) badge = `🟢 ${periodLabel} Performance Score: ` + score + "/100 — Excellent";
  else if (score >= 70 && totalResults > 3) badge = `🟢 ${periodLabel} Performance Score: ` + score + "/100 — Good";
  else if (score >= 50) badge = `🟡 Campaigns On Track — performing as expected this ${periodWord}`;
  else badge = `⚙️ Campaigns under active optimisation this ${periodWord}`;

  return { score, badge };
}

/** Port of the budget portion of fillCoverExtras_. Returns '' if no budget is set. */
export function budgetSummaryLine(
  mtdSpend: number,
  monthlyBudget: number | null | undefined,
  currencySymbol: string,
  now: Date = new Date(),
): string {
  if (!monthlyBudget || monthlyBudget <= 0) return "";

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  // Fix 6 — always a whole-number percentage ("20%"), never one decimal
  // place ("20.6%").
  const pctUsed = Math.round((mtdSpend / monthlyBudget) * 100);

  return (
    "Monthly Ad Budget: " +
    currencySymbol +
    mtdSpend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) +
    " of " +
    currencySymbol +
    monthlyBudget.toLocaleString("en-US") +
    " used (" +
    pctUsed +
    "%) — " +
    daysLeft +
    " days remaining"
  );
}
