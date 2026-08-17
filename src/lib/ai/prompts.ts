/**
 * AI prompt construction for the two per-slide AI calls (campaign/ad-set
 * summary + key insights). Both prompts are a fixed, exact structure
 * (product owner's explicit spec) — every {token} in the trailing "Data:"
 * line is substituted with this slide's real numbers; everything else is
 * sent to the model verbatim, including the square-bracketed phrases in the
 * "Sentence N: ..." structure instructions, which describe what the model
 * should write in its own words rather than tokens we fill in.
 *
 * There is deliberately no separate "zero results" or "zero spend" prompt
 * variant here — a zero-spend slide never reaches these functions at all
 * (see generate-insights.ts's isZeroSpend check, which substitutes fixed
 * hardcoded copy instead of calling the AI), and a slide with spend but
 * zero results relies on the prompt's own "if a metric is zero or
 * unavailable use the word zero or not available" rule.
 */

import type { AiContext } from "../nre/report-data";
import { parseCellNum } from "../nre/format";

/**
 * A Reach/Awareness campaign has no conversion objective at all — its
 * costLabel is "COST PER 1K REACH" and its `results`/`resultsNum` are
 * always structurally 0 (Meta doesn't populate a results count for pure
 * awareness campaigns; see aggregate.ts's own REACH handling). The generic
 * prompt/fallback templates below all center on "the primary result count
 * and cost," which produces nonsense for Reach ("recorded no REACH this
 * week") or, worse, invites the model to substitute a plausible-sounding
 * but WRONG conversion metric from its own examples (the reported bug: a
 * Reach campaign's summary opening with "recorded no purchases at $0 cost
 * per purchase" — Reach has no purchase objective at all). Every
 * summary-generation function below branches on this check first.
 */
function isReachCampaign(ctx: Pick<AiContext, "resultLabel">): boolean {
  return ctx.resultLabel === "REACH";
}

export function buildSummaryPrompt(ctx: AiContext): string {
  if (isReachCampaign(ctx)) {
    return (
      "This is a REACH/AWARENESS campaign. Do NOT mention results, purchases, leads or conversions. Focus only on reach, impressions, frequency, CPM, CTR and CPC.\n" +
      "Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences.\n" +
      "Sentence 1 must mention ALL of these in order:\n" +
      "- Reach (people reached) and impressions\n" +
      "- The CPM (cost per 1,000 impressions)\n" +
      "- The average frequency\n" +
      "Sentence 2 must mention:\n" +
      "- CTR percentage\n" +
      "- CPC value\n" +
      "- A brief audience-engagement observation\n" +
      "Example of correct format: \"This campaign reached 22,170 people with 28,192 impressions at a $8.50 CPM, maintaining a 1.3x average frequency. The campaign achieved a 2.0% click-through rate at $1.23 cost per click, reflecting current audience engagement levels.\"\n" +
      "Rules:\n" +
      "- Do NOT mention results, purchases, leads, link clicks, or any conversion count — this campaign has no conversion objective\n" +
      "- Do NOT mention ad sets, combined ad sets, delivery status, or any technical implementation details. Write only about campaign performance metrics as if presenting to a client.\n" +
      "- Use real numbers from the data — never invent or estimate\n" +
      "- Keep total under 60 words\n" +
      "- Professional tone like a senior account manager\n\n" +
      "Data: Campaign: " + ctx.ctx + ", Date: " + ctx.dateRange + ", Spend: " + ctx.spend + ", Reach: " + ctx.reach +
      ", Impressions: " + ctx.impressions + ", CPM: " + ctx.cpm + ", Frequency: " + ctx.freq.toFixed(1) + "x" +
      ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc
    );
  }
  return (
    "Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences.\n" +
    "Sentence 1 must mention ALL of these in order:\n" +
    "- The primary result count and label (e.g. 20 leads, 47 website leads, 312 link clicks, 5 purchases)\n" +
    "- The cost per result (e.g. at $40 per lead, at $6.04 cost per lead)\n" +
    "- The total spend (e.g. spending $800 this week)\n" +
    "- Reach and impressions\n" +
    "Sentence 2 must mention:\n" +
    "- CTR percentage\n" +
    "- CPC value\n" +
    "- A brief engagement observation\n" +
    "Example of correct format: \"This campaign generated 20 leads at $40 cost per lead, spending $800 to reach 22,170 people across 28,192 impressions. The campaign achieved a 2.0% click-through rate at $1.23 cost per click, reflecting moderate audience engagement this week.\"\n" +
    "Rules:\n" +
    "- ALWAYS mention the primary result count and cost in sentence 1 — this is the most important metric\n" +
    "- If results = 0, say \"recorded no [result label] this week\" in sentence 1\n" +
    "- Do NOT mention ad sets, combined ad sets, delivery status, or any technical implementation details. Write only about campaign performance metrics as if presenting to a client.\n" +
    "- Use real numbers from the data — never invent or estimate\n" +
    "- Keep total under 60 words\n" +
    "- Professional tone like a senior account manager\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Date: " + ctx.dateRange + ", Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", Impressions: " + ctx.impressions + ", " + ctx.resultLabel + ": " + ctx.results + ", " + ctx.costLabel + ": " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc
  );
}

export function buildInsightPrompt(ctx: AiContext): string {
  return (
    "Write the Key Insights and Next Strategy section for a Meta Ads weekly client report. Write exactly 3 sentences following this structure:\n" +
    "Sentence 1: One specific insight about what performed well or what the data shows this week — cite a real metric number.\n" +
    "Sentence 2: One specific insight about what needs attention or a notable trend — cite a real metric number.\n" +
    "Sentence 3: The recommended next actions — always include: allocating budget toward top-performing ads, pausing underperformers, testing new creatives, and refining targeting or bidding strategy.\n" +
    "Rules:\n" +
    "- Always cite actual numbers from the data provided\n" +
    "- Do not use bullet points, headers, dashes, or line breaks\n" +
    "- Keep total length under 75 words\n" +
    "- Do not start with This week or During this period — vary the opening\n" +
    "- Do NOT mention ad sets, combined ad sets, delivery status, or any technical implementation details. Write only about campaign performance metrics as if presenting to a client.\n" +
    "- Sound like a senior account manager giving honest strategic advice\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", " + ctx.resultLabel + ": " + ctx.results + ", " + ctx.costLabel + ": " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc
  );
}

/**
 * ctx.ctr already carries its own "%" suffix (see report-data.ts's
 * fmtPercent) — the fallback templates below both write a literal "%"
 * immediately after the value, so this strips the one already baked into
 * the string to avoid "4.48%%".
 */
function ctrNumberOnly(ctr: string): string {
  return ctr.endsWith("%") ? ctr.slice(0, -1) : ctr;
}

/**
 * Fixed, always-complete summary for a REACH/AWARENESS campaign — shared by
 * buildZeroResultsSummary and buildFallbackSummary below (Reach's `results`
 * is structurally always 0, so both of those functions' own reasons for
 * firing coincide for a Reach campaign). Never mentions results, purchases,
 * leads, or any conversion metric — a Reach campaign has no conversion
 * objective, so those tokens can only ever be wrong here. Matches the exact
 * wording spec: "This campaign reached [reach] people with [impressions]
 * impressions at a [cpm] CPM, maintaining a [frequency]x average frequency.
 * The campaign achieved a [ctr]% click-through rate at [cpc] cost per
 * click, reflecting current audience engagement levels."
 */
function buildReachSummary(ctx: AiContext): string {
  return (
    "This campaign reached " + ctx.reach + " people with " + ctx.impressions + " impressions at a " + ctx.cpm +
    " CPM, maintaining a " + ctx.freq.toFixed(1) + "x average frequency. The campaign achieved a " +
    ctrNumberOnly(ctx.ctr) + "% click-through rate at " + ctx.cpc + " cost per click, reflecting current audience " +
    "engagement levels."
  );
}

/**
 * Deterministic replacement for buildSummaryPrompt's AI output on a slide
 * that has real spend/delivery but exactly zero results this week (Fix 6).
 * Never sent through the AI at all — CPR is mathematically undefined at
 * zero results (see report-data.ts's computeTableRow/objective.ts, which
 * both render it as "—" precisely when count is 0), and asking the model to
 * write "generated 0 [X] at a [CPR] cost" with that plugged in verbatim
 * produced sentences like "generated 0 website leads at a — cost" — the
 * reported bug. This sidesteps the CPR/count phrasing entirely rather than
 * prompting the AI to avoid it, since a real, always-complete sentence is
 * more reliable than trusting the model wends around a dash in a template.
 *
 * REACH campaigns get their own dedicated wording (buildReachSummary) —
 * never "recorded no REACH," which reads as nonsense (reach itself is
 * never actually zero; only the unrelated `results` counter is). Every
 * other objective's own resultLabel is lower-cased for natural phrasing
 * ("recorded no website leads" / "recorded no purchases" / "recorded no
 * link clicks") — this was already substituting the campaign's real,
 * correct resultLabel dynamically (never a hardcoded "purchases"), just not
 * lower-cased before.
 */
export function buildZeroResultsSummary(ctx: AiContext): string {
  if (isReachCampaign(ctx)) return buildReachSummary(ctx);
  return (
    "This campaign is active but recorded no " + ctx.resultLabel.toLowerCase() + " this week, with " + ctx.spend +
    " spent reaching " + ctx.reach + " people across " + ctx.impressions + " impressions. The campaign is in the " +
    "optimisation phase and performance is expected to improve as the algorithm learns."
  );
}

/**
 * Fix 4 — the OTHER zero-results case: a campaign/ad set the CSV's own
 * delivery_status column reports as Paused/Inactive (AiContext.isInactive),
 * not merely one with a zero result count. Never mentions resultLabel at
 * all (unlike buildZeroResultsSummary above), so this is also the correct
 * wording for a paused REACH campaign — REACH's own `results` is always
 * structurally 0 regardless of delivery status, but "paused with no new
 * results" reads correctly either way since it isn't claiming anything
 * about a specific results metric. Real spend/reach/impressions are still
 * substituted in (not hardcoded to zero) since a campaign paused partway
 * through the week can still have genuine, nonzero numbers to report.
 */
export function buildPausedZeroResultsSummary(ctx: AiContext): string {
  return (
    "This campaign was paused this week with no new results recorded. During the period " + ctx.spend +
    " was spent reaching " + ctx.reach + " people across " + ctx.impressions + " impressions."
  );
}

/**
 * Fix 4 — insights companion to buildPausedZeroResultsSummary, for the same
 * no-AI-call paused/inactive state. Doesn't claim "no spend recorded" the
 * way the older fixed PAUSED_INSIGHTS_TEXT copy did — that's no longer
 * always true now that a mid-week pause can leave real, nonzero numbers on
 * the slide (see buildPausedZeroResultsSummary's own doc comment).
 */
export function buildPausedZeroResultsInsights(): string {
  return (
    "The campaign was paused this week, so no new performance data is available. Once reactivated, budget will " +
    "be directed toward the previous top-performing ads while underperformers stay paused, with creatives and " +
    "targeting refreshed before spend ramps back up."
  );
}

/**
 * Deterministic, always-complete replacement for buildSummaryPrompt's AI
 * output when that output comes back truncated (see generate-insights.ts's
 * end-with-a-period check) — built entirely from data already on hand, so
 * it can never itself be cut off mid-sentence the way an AI response can.
 * Fix 3 — no longer opens with "During [dateRange], the [campaignName]
 * campaign...", matching buildSummaryPrompt's own new "don't repeat what's
 * already on the slide" instruction. Mirrors buildSummaryPrompt's own
 * required structure exactly (results + cost per result always first,
 * spend/reach/impressions in sentence 1, CTR/CPC in sentence 2) — this
 * fallback must never omit results and cost per result the way the AI
 * output previously could.
 *
 * REACH campaigns get buildReachSummary instead — `results` is
 * structurally always 0 for Reach, so the generic template here would
 * otherwise always read "generated 0 REACH at [cost] COST PER 1K REACH,"
 * the same category of wrong-metric bug this whole fix addresses.
 */
export function buildFallbackSummary(ctx: AiContext): string {
  if (isReachCampaign(ctx)) return buildReachSummary(ctx);
  return (
    "This campaign generated " + ctx.results + " " + ctx.resultLabel + " at " + ctx.cpr + " " + ctx.costLabel +
    ", spending " + ctx.spend + " to reach " + ctx.reach + " people across " + ctx.impressions +
    " impressions. The campaign achieved a " + ctrNumberOnly(ctx.ctr) + "% click-through rate at " + ctx.cpc +
    " cost per click, reflecting current audience engagement levels."
  );
}

// Results-volume wording for buildFallbackInsights — no explicit thresholds
// were specified for this hardcoded fallback (unlike the numeric rules
// elsewhere in this app), so these are a reasonable, documented judgment
// call: "early" mirrors health.ts's own learning-phase results<3 threshold,
// "strong" is a round double-digit result count, "developing" is everything
// in between.
function tractionWord(resultsNum: number): string {
  if (resultsNum < 3) return "early";
  if (resultsNum < 10) return "developing";
  return "strong";
}

/**
 * Deterministic, always-complete replacement for buildInsightPrompt's AI
 * output when that output comes back truncated — same role as
 * buildFallbackSummary above, for the Key Insights section instead.
 */
export function buildFallbackInsights(ctx: AiContext): string {
  return (
    "This week " + ctx.ctx + " spent " + ctx.spend + " reaching " + ctx.reach + " people with a " +
    ctrNumberOnly(ctx.ctr) + "% CTR. With " + ctx.results + " " + ctx.resultLabel + " recorded, the campaign shows " +
    tractionWord(ctx.resultsNum) + " traction at " + ctx.cpr + " per result. To maximise results, budget will shift " +
    "toward top-performing ads while underperformers are paused, with fresh creatives and refined targeting planned " +
    "for the coming week."
  );
}

// Real, honest lengths under the current (exact-structure) prompts:
// buildFallbackSummary's own 2-sentence output — which follows the identical
// structure the AI is asked to produce, real numbers and all — routinely
// lands around 300 characters, and buildFallbackInsights' 3-sentence output
// around 360. The OLD caps here (220 / 320, ported from a much shorter
// legacy prompt) were re-truncating a perfectly COMPLETE response before it
// ever reached the slide — the actual cause of a truncation bug reported
// against this exact prompt structure, not anything upstream (the AI
// response itself was fine; this safety net was quietly cutting it down
// again afterward). Raised well past the realistic complete-response length
// so a normal, instruction-following response never gets touched — this
// still catches a genuinely runaway response, just no longer a normal one.
const SUMMARY_CHAR_LIMIT = 400;
const INSIGHTS_CHAR_LIMIT = 500;

/**
 * True when `text[index]` is a period that reads as a SENTENCE end — at the
 * end of the string, or followed by whitespace — rather than a decimal
 * point inside a number like "$2.50" or "2.00%", which is always followed
 * immediately by another digit, never whitespace. The previous version of
 * this cap used a bare `lastIndexOf(".", limit)`, which happily matched the
 * "." in "2.00%" as if it were a sentence end and cut the response off
 * right there, mid-value — this is the fix for that.
 */
function isSentenceEndingPeriod(text: string, index: number): boolean {
  if (text[index] !== ".") return false;
  const next = text[index + 1];
  return next === undefined || /\s/.test(next);
}

function lastSentenceEndAtOrBefore(text: string, limit: number): number {
  for (let i = Math.min(limit, text.length - 1); i >= 0; i--) {
    if (isSentenceEndingPeriod(text, i)) return i;
  }
  return -1;
}

/**
 * The first standalone integer in `text` that isn't a currency amount (not
 * preceded by "$"/similar) or a percentage (not followed by "%") — the
 * summary prompt's own required structure ("Sentence 1 must mention ALL of
 * these in order: The primary result count and label ... the cost per
 * result ... the total spend ... reach and impressions") puts the result
 * count first, before any dollar or percentage figure, so this is a
 * reasonable proxy for "the number the AI is claiming as the result count."
 * Commas inside the number (e.g. "1,234") are tolerated.
 */
function extractFirstResultCount(text: string): number | null {
  const match = text.match(/(?<![$.\d,])(\d[\d,]*)(?!\.\d)(?!%)/);
  return match ? parseCellNum(match[1]) : null;
}

/**
 * True when the AI's own summary text opens with a result-count number that
 * disagrees with the slide's real, slot-assignment-derived count
 * (`expectedCount`, i.e. AiContext.resultsNum) by more than 10% — the
 * validation this fix adds on top of the existing truncation/period checks,
 * so an AI response that's a complete, well-formed sentence but simply
 * states the WRONG number (a hallucination, not a truncation) still gets
 * rejected in favor of the deterministic fallback template, which is always
 * built from the real number. No number found in the text isn't treated as
 * a mismatch here — the existing endsComplete/countSentenceEndings checks
 * already catch a malformed response; this check only fires when a number
 * IS present and it's simply wrong.
 */
export function resultCountMismatch(aiText: string, expectedCount: number): boolean {
  const found = extractFirstResultCount(aiText);
  if (found === null) return false;
  if (expectedCount === 0) return found !== 0;
  return Math.abs(found - expectedCount) / expectedCount > 0.1;
}

/**
 * Counts sentence-ending periods in `text` (see isSentenceEndingPeriod) —
 * used by generate-insights.ts's final safety net as "does this actually
 * read as N complete sentences," not just "does it end with *a* period."
 * Deliberately the same decimal-point-aware logic as the cut point above,
 * so a $-amount or percentage never gets miscounted as an extra sentence.
 */
export function countSentenceEndings(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (isSentenceEndingPeriod(text, i)) count++;
  }
  return count;
}

/** Safety net in case the AI ignores the prompt's own "under 60 words" instruction, not a target length in itself — see SUMMARY_CHAR_LIMIT's comment for why this is no longer 220. */
export function capSummary(raw: string): string {
  const summary = raw.trim();
  if (summary.length <= SUMMARY_CHAR_LIMIT) return summary;
  const cut = lastSentenceEndAtOrBefore(summary, SUMMARY_CHAR_LIMIT);
  return cut > 60 ? summary.slice(0, cut + 1) : summary.slice(0, SUMMARY_CHAR_LIMIT).trim() + ".";
}

/** Same safety-net role as capSummary, sized for the "under 75 words" insights prompt — see SUMMARY_CHAR_LIMIT's comment. */
export function capInsights(raw: string): string {
  const stripped = raw.trim().replace(/^[-•*]\s*/, "");
  let insights = stripped;
  if (stripped.length > INSIGHTS_CHAR_LIMIT) {
    const cut = lastSentenceEndAtOrBefore(stripped, INSIGHTS_CHAR_LIMIT);
    insights = cut > 80 ? stripped.slice(0, cut + 1) : stripped.slice(0, INSIGHTS_CHAR_LIMIT).trim() + ".";
  }
  return insights || "Insights not available.";
}
