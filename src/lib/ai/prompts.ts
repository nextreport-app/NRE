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

/** Port of the 220-char summary cap from writeInsights_ — a safety net in case the AI ignores the prompt's own "under 60 words" instruction, not a target length in itself. */
export function capSummary(raw: string): string {
  const summary = raw.trim();
  if (summary.length <= 220) return summary;
  const cut = summary.lastIndexOf(".", 220);
  return cut > 60 ? summary.slice(0, cut + 1) : summary.slice(0, 220).trim() + ".";
}

/** Port of the 320-char insights cap from writeInsights_ — same safety-net role as capSummary, sized for the "under 75 words" insights prompt. */
export function capInsights(raw: string): string {
  const stripped = raw.trim().replace(/^[-•*]\s*/, "");
  let insights = stripped;
  if (stripped.length > 320) {
    const cut = stripped.lastIndexOf(".", 320);
    insights = cut > 80 ? stripped.slice(0, cut + 1) : stripped.slice(0, 320).trim() + ".";
  }
  return insights || "Insights not available.";
}
