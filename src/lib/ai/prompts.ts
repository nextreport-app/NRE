/**
 * AI prompt construction — verbatim port of the summaryPrompt/insightPrompt
 * template strings inside writeInsights_ from meta_ads_report_v4.js.
 *
 * Per explicit instruction: these are ported EXACTLY, including the
 * insightPrompt's accidental duplicated opening sentence ("Write the Key
 * Insights & Next Strategy section for a Meta Ads weekly report." appears
 * twice in the source) — not cleaned up, to keep AI output identical to
 * what the tested script produces.
 *
 * The one change from the source: the campaign-summary branch's `cpr` input
 * uses the AiContext's already-correct value instead of writeInsights_'s own
 * broken recomputation (see report-data.ts's file header for why).
 */

import type { AiContext } from "../nre/report-data";

function freqNote(freq: number): string {
  if (freq <= 0) return "";
  const base = " Ad frequency: " + freq.toFixed(1) + " impressions per person.";
  return base + (freq > 3.5 ? " High frequency — audience may be experiencing creative fatigue." : "");
}

export function buildSummaryPrompt(ctx: AiContext): string {
  const note = freqNote(ctx.freq);

  if (ctx.hasResults) {
    return (
      "Write a campaign performance summary for a Meta Ads weekly client report. " +
      "Write a single concise paragraph (under 65 words) that covers ALL of these metrics naturally: " +
      "Ad Spend, Reach, " + ctx.resultLabel + " count, " + ctx.costLabel + ", CTR, and CPC. " +
      "Write it as a real account manager would — professional, confident, metric-rich. " +
      "No bullets, no headings. Use all the numbers given. " +
      "Campaign: " + ctx.ctx + ". Spend: " + ctx.spend + ", Reach: " + ctx.reach +
      ", " + ctx.resultLabel + ": " + ctx.results + ", " + ctx.costLabel + ": " + ctx.cpr +
      ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc + "." + note +
      " Output only the 2 paragraphs."
    );
  }

  return (
    "Write a campaign performance summary for Meta Ads weekly report where results are 0. " +
    "Write EXACTLY 2 short paragraphs, each 1-2 sentences. Total under 50 words. " +
    "Paragraph 1: acknowledge reach and impressions generated. " +
    "Paragraph 2: frame as awareness/learning phase, one next action. " +
    'No bullets. NEVER use "outstanding", "exceptional". ' +
    "Campaign: " + ctx.ctx + ". Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc + ", Results: 0, Cost per Result: N/A." + note +
    " Output only the 2 paragraphs."
  );
}

export function buildInsightPrompt(ctx: AiContext): string {
  const note = freqNote(ctx.freq);
  return (
    "Write the Key Insights & Next Strategy section for a Meta Ads weekly report. " +
    "Write the Key Insights & Next Strategy section for a Meta Ads weekly report. " +
    "Write a single flowing paragraph of 4-5 sentences with NO bullets, NO dashes, NO line breaks. " +
    "Cover: 2 key performance insights from this week (cite actual numbers), then 2 specific strategy actions for next week. " +
    "Sound like a senior account manager. Natural, confident, metric-driven. Under 90 words." +
    (ctx.freq > 3.5 ? " Mention high frequency as a creative refresh signal." : "") +
    " Sentences 4-5: exactly 2 specific recommended actions for NEXT week (what to test, adjust, or prioritise). " +
    "Sound like a real account manager. Use actual numbers. Under 100 words. " +
    (ctx.hasResults ? "" : "Results are 0 — do not frame this positively. ") +
    "Campaign: " + ctx.ctx + ". Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc + ", " + ctx.resultLabel + ": " + ctx.results + "." + note +
    " Output only the paragraph, nothing else."
  );
}

/** Port of the 220-char summary cap from writeInsights_. */
export function capSummary(raw: string): string {
  const summary = raw.trim();
  if (summary.length <= 220) return summary;
  const cut = summary.lastIndexOf(".", 220);
  return cut > 60 ? summary.slice(0, cut + 1) : summary.slice(0, 220).trim() + ".";
}

/** Port of the 320-char insights cap from writeInsights_. */
export function capInsights(raw: string): string {
  const stripped = raw.trim().replace(/^[-•*]\s*/, "");
  let insights = stripped;
  if (stripped.length > 320) {
    const cut = stripped.lastIndexOf(".", 320);
    insights = cut > 80 ? stripped.slice(0, cut + 1) : stripped.slice(0, 320).trim() + ".";
  }
  return insights || "Insights not available.";
}
