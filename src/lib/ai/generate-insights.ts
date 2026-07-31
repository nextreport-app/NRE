/**
 * Orchestrates AI-written copy for every campaign/ad-set slide in a report.
 * One summary + one insights call per slide (matching writeInsights_, which
 * runs per-slide in the source too) — run concurrently since Node isn't
 * constrained by Apps Script's synchronous execution model; each slide's
 * pair of calls is independent and failures are isolated per slide.
 *
 * Zero-spend slides (a paused campaign/ad set — spend under a cent for the
 * week) skip the AI call entirely and get fixed placeholder copy instead:
 * there's nothing real to summarize, and asking an LLM to write about $0 of
 * activity tends to either hallucinate detail or produce an oddly-worded
 * "no data" paragraph — a fixed, deliberately-worded paragraph reads better
 * and costs nothing per campaign. This is a per-slide check (product
 * decision), not account-wide: one paused campaign among several active
 * ones only replaces that one slide's copy.
 *
 * Separately, a NON-zero-spend slide's AI response can come back truncated
 * mid-sentence (e.g. "...achieved a 4.48% click-through rate and a $2." with
 * the actual CPC value cut off). Two independent defenses, in order:
 *
 *  1. The raw response is checked for a trailing period right after the AI
 *     call — a response that doesn't end with one is discarded outright in
 *     favor of a deterministic, data-only fallback sentence
 *     (buildFallbackSummary/buildFallbackInsights) that can't itself be cut
 *     off, since it's built from values already on hand rather than
 *     generated token-by-token.
 *
 *  2. A FINAL check runs on the text that's actually about to be written to
 *     the slide — after capSummary/capInsights, not the raw or trimmed
 *     values from step 1 — counting real sentence-ending periods. This is
 *     the check that matters most: the truncation bug actually reported
 *     against this file passed check #1 (the raw AI response was a
 *     genuinely complete, correctly-terminated sentence) and was introduced
 *     by capSummary/capInsights AFTERWARD, which used to mistake a decimal
 *     point inside a dollar amount or percentage (e.g. the "." in "$2.50")
 *     for a sentence end and cut the response off right there — see
 *     prompts.ts's countSentenceEndings/isSentenceEndingPeriod for the fix
 *     to that specific bug. Step 2 exists so that ANY step between the raw
 *     AI call and the slide — capSummary/capInsights today, anything added
 *     later — can never silently reintroduce truncation without this
 *     catching it and substituting the same safe fallback.
 *
 * A THIRD case (Fix 6), independent of the two above: a slide with real
 * spend/delivery but exactly zero results this week (a lead-gen campaign
 * that hasn't converted yet, say). CPR is mathematically undefined at zero
 * results, so it always renders as "—" (see report-data.ts/objective.ts),
 * and the AI plugging that dash straight into the summary prompt's "at a
 * [CPR] cost" phrasing produced nonsensical sentences like "generated 0
 * website leads at a — cost" (the actual reported bug). Handled the same
 * way as the zero-spend case — a deterministic sentence, no AI call for the
 * summary — but with its own wording (buildZeroResultsSummary) that never
 * mentions CPR at all, rather than reusing the paused-campaign copy, since
 * "no results yet" and "no delivery at all" are different, both-true-ish-
 * often states that shouldn't read identically to the client. The insights
 * call is unaffected — it doesn't share the summary prompt's CPR phrasing.
 */

import type { AiContext, ReportData } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/render";
import { callAI, type AiKeys } from "./client";
import {
  buildFallbackInsights,
  buildFallbackSummary,
  buildInsightPrompt,
  buildSummaryPrompt,
  buildZeroResultsSummary,
  capInsights,
  capSummary,
  countSentenceEndings,
} from "./prompts";

// Sub-cent spend is treated as zero — CSV/currency rounding can leave a
// fractional cent on an otherwise-inactive campaign, and that's still
// "paused," not "spent something."
const ZERO_SPEND_THRESHOLD = 0.01;

const PAUSED_SUMMARY_TEXT =
  "This campaign was inactive during the reporting period with no spend, reach, or impressions recorded. The campaign is currently paused pending further instructions.";

const PAUSED_INSIGHTS_TEXT =
  "The campaign remained inactive this week with no delivery or spend recorded. Once reactivated, budget will be directed toward top-performing creatives while underperformers are paused, with targeting refined to improve overall efficiency.";

// The prompts ask for exactly 2 sentences (summary) / exactly 3 (insights) —
// the final safety net's "does this actually read as N complete sentences"
// check uses these as its threshold.
const MIN_SUMMARY_SENTENCES = 2;
const MIN_INSIGHTS_SENTENCES = 3;

function isZeroSpend(ctx: AiContext): boolean {
  return ctx.spendNum < ZERO_SPEND_THRESHOLD;
}

/**
 * True for a slide with real spend/delivery but zero results this week —
 * see this file's header for why that needs its own deterministic summary
 * rather than either the paused-campaign copy or a normal AI call. Reach
 * objective slides are excluded: `resultsNum` there is legitimately always
 * 0 (Reach doesn't have a "results" count the way conversions do — see
 * report-data.ts's ai.resultsNum, summed straight from the CSV's Results
 * column, which Reach exports typically leave blank/0), so this would
 * otherwise misfire on every healthy Reach campaign, not just genuinely
 * zero-converting ones.
 */
function isZeroResults(ctx: AiContext): boolean {
  return ctx.resultsNum === 0 && ctx.resultLabel !== "REACH";
}

/** True when `text` (already trimmed) reads as a complete sentence rather than one cut off mid-word/mid-number. */
function endsComplete(trimmedText: string): boolean {
  return trimmedText.endsWith(".");
}

export async function generateInsights(data: ReportData, keys: AiKeys): Promise<Map<string, AiCopy>> {
  const slides = [...data.campaignSlides, ...data.adSetSlides];
  const results = new Map<string, AiCopy>();

  await Promise.all(
    slides.map(async (slide) => {
      const name = slide.campaignName;

      if (isZeroSpend(slide.ai)) {
        // Fixed copy, used verbatim — not run through capSummary/capInsights,
        // which exist only to bound unpredictable AI output.
        results.set(slideAiKey(slide), { summary: PAUSED_SUMMARY_TEXT, insights: PAUSED_INSIGHTS_TEXT });
        return;
      }

      const zeroResults = isZeroResults(slide.ai);

      const [rawSummary, rawInsight] = await Promise.all([
        // Never sent to the AI for a zero-results slide — see this file's
        // header and buildZeroResultsSummary's own doc comment.
        zeroResults ? Promise.resolve(null) : callAI(buildSummaryPrompt(slide.ai), keys),
        callAI(buildInsightPrompt(slide.ai), keys),
      ]);

      // Debug: the exact response the AI returned, BEFORE any period check
      // or capping — printed unconditionally (not just when truncation is
      // suspected) so a "why did this fall back" question can always be
      // answered from the logs after the fact. null here means the summary
      // AI call was skipped outright (zero-results slide, see above).
      console.log(`[ai:generate-insights] Raw AI response for ${name}: ${zeroResults ? "(skipped — zero results)" : rawSummary}`);

      let summary: string;
      let summaryFallback: boolean;
      if (zeroResults) {
        summary = buildZeroResultsSummary(slide.ai);
        summaryFallback = false; // deliberate, structured copy — not a truncation recovery
      } else {
        // Trailing whitespace (the AI sometimes appends a stray space after
        // the last character) would otherwise make a complete response look
        // truncated to an endsComplete() check — trim before checking.
        const trimmedSummary = rawSummary!.trim();
        summaryFallback = !endsComplete(trimmedSummary);
        summary = summaryFallback ? buildFallbackSummary(slide.ai) : capSummary(trimmedSummary);
      }
      console.log(`[ai:generate-insights] Fallback triggered: ${summaryFallback} for ${name}`);

      // Final safety net: checks `summary` — the actual text about to be
      // written to the slide, after capSummary already ran — not rawSummary
      // or trimmedSummary above. This is deliberate: those intermediate
      // values already passed their own check once; what matters is whether
      // the FINAL text still reads as a complete 2-sentence summary.
      // (buildZeroResultsSummary is always 2 real sentences, so this never
      // actually re-fires for the zeroResults branch above — but it's left
      // unconditional rather than skipped for that case, so a future edit
      // to that template can't silently ship a truncated one either.)
      if (countSentenceEndings(summary) < MIN_SUMMARY_SENTENCES) {
        if (!summaryFallback) {
          console.warn(
            `[ai:generate-insights] Final summary text for ${name} was incomplete even though the raw AI response passed the period check (capSummary likely re-truncated it) — forcing structured fallback`,
          );
        }
        summary = buildFallbackSummary(slide.ai);
        summaryFallback = true;
      }

      const trimmedInsight = rawInsight.trim();
      let insights: string;
      let insightsFallback = !endsComplete(trimmedInsight);
      if (insightsFallback) {
        insights = buildFallbackInsights(slide.ai);
      } else {
        insights = capInsights(trimmedInsight);
      }

      if (countSentenceEndings(insights) < MIN_INSIGHTS_SENTENCES) {
        if (!insightsFallback) {
          console.warn(
            `[ai:generate-insights] Final insights text for ${name} was incomplete even though the raw AI response passed the period check (capInsights likely re-truncated it) — forcing structured fallback`,
          );
        }
        insights = buildFallbackInsights(slide.ai);
        insightsFallback = true;
      }

      results.set(slideAiKey(slide), { summary, insights });
    }),
  );

  return results;
}
