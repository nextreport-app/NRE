/**
 * NRE v1 — Account Health Score + budget summary.
 * Direct port of calculateAccountHealth_ / fillCoverExtras_ from
 * meta_ads_report_v4.js.
 *
 * The original also threaded a week-over-week (WoW) comparison through this
 * function, but the WoW data source was removed upstream (`var prev = null;
 * // WoW removed`), so `hasWoW` was always false and every WoW-guarded branch
 * was dead code. That's simplified away here to its always-taken branch —
 * the resulting score and thresholds are bit-for-bit identical to the
 * original's actual (tested) behaviour.
 *
 * One intentional deviation: the original's budget line hardcodes '$'
 * regardless of the account's CURRENCY_SYMBOL config (a single-currency
 * script whose only tested account used USD). NextReport is multi-currency
 * per client, so the client's actual currency symbol is used here instead —
 * the budget math itself (spend / budget %, days remaining) is unchanged.
 */

import { parseCellNum } from "./format";
import type { AggRow } from "./aggregate";

export interface AccountHealth {
  score: number;
  badge: string;
}

/** Port of calculateAccountHealth_. */
export function calculateAccountHealth(weeklyRows: AggRow[]): AccountHealth {
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

  let score = 0;

  // 1. Results delivery (35 pts) — no WoW source, so always the "has results,
  //    no comparison" branch (25 pts) or the zero-results floor (5 pts).
  score += totalResults > 0 ? 25 : 5;

  // 2. CTR engagement (25 pts)
  if (avgCtr >= 3.0) score += 25;
  else if (avgCtr >= 2.0) score += 20;
  else if (avgCtr >= 1.0) score += 13;
  else if (avgCtr >= 0.5) score += 6;
  else if (avgCtr > 0) score += 2;

  // 3. Audience frequency health (20 pts)
  if (avgFreq === 0) score += 14; // no frequency data — neutral
  else if (avgFreq < 2.0) score += 20;
  else if (avgFreq < 2.5) score += 17;
  else if (avgFreq < 3.5) score += 12;
  else if (avgFreq < 5.0) score += 5;
  // else freq >= 5 → 0 pts

  // 4. Cost efficiency (20 pts) — no WoW source, so always the neutral branch.
  score += 12;

  score = Math.min(100, Math.max(0, score));

  let badge: string;
  if (score >= 80) badge = "🟢 Weekly Performance Score: " + score + "/100 — Excellent";
  else if (score >= 70) badge = "🟢 Weekly Performance Score: " + score + "/100 — Good";
  else if (score >= 50) badge = "🟡 Campaigns On Track — performing as expected this week";
  else badge = "⚙️ Campaigns under active optimisation this week";

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
  const pctUsed = ((mtdSpend / monthlyBudget) * 100).toFixed(1);

  return (
    "Monthly Budget: " +
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
