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

export function buildSummaryPrompt(ctx: AiContext): string {
  return (
    "Write a campaign performance summary for a Meta Ads weekly client report. Write exactly 2 sentences following this structure:\n" +
    "Sentence 1: During [date range], the [campaign name] campaign generated [results count] [objective label] at a [CPR] [cost label], reaching [reach] people with [impressions] impressions.\n" +
    "Sentence 2: The campaign achieved a [CTR]% click-through rate and a [CPC] cost per click, reflecting [positive/neutral/cautious] audience engagement this week.\n" +
    "Rules:\n" +
    "- Always use the real numbers provided — never invent or estimate\n" +
    "- If a metric is zero or unavailable use the word zero or not available\n" +
    "- Do not add any text before or after the two sentences\n" +
    "- Do not use bullet points, headers, or line breaks\n" +
    "- Keep total length under 60 words\n" +
    "- Sound professional and factual, like a senior account manager\n\n" +
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
 */
export function buildZeroResultsSummary(ctx: AiContext): string {
  return (
    "During " + ctx.dateRange + ", the " + ctx.ctx + " campaign recorded no " + ctx.resultLabel +
    " this week, with " + ctx.spend + " spent reaching " + ctx.reach + " people across " + ctx.impressions +
    " impressions. The campaign maintained a " + ctrNumberOnly(ctx.ctr) + "% click-through rate at " + ctx.cpc +
    " cost per click, with delivery active and results expected as the campaign optimises."
  );
}

/**
 * Deterministic, always-complete replacement for buildSummaryPrompt's AI
 * output when that output comes back truncated (see generate-insights.ts's
 * end-with-a-period check) — built entirely from data already on hand, so
 * it can never itself be cut off mid-sentence the way an AI response can.
 */
export function buildFallbackSummary(ctx: AiContext): string {
  return (
    "During " + ctx.dateRange + ", the " + ctx.ctx + " campaign generated " + ctx.results + " " + ctx.resultLabel +
    " at a " + ctx.cpr + " " + ctx.costLabel + ", reaching " + ctx.reach + " people with " + ctx.impressions +
    " impressions. The campaign achieved a " + ctrNumberOnly(ctx.ctr) + "% click-through rate and a " + ctx.cpc +
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
