/**
 * Orchestrates AI-written copy for every campaign/ad-set slide in a report.
 * One summary + one insights call per slide (matching writeInsights_, which
 * runs per-slide in the source too) — run concurrently since Node isn't
 * constrained by Apps Script's synchronous execution model; each slide's
 * pair of calls is independent and failures are isolated per slide.
 *
 * Paused/inactive slides (Fix 4 — the CSV's own delivery_status column
 * reports Paused/Inactive, or spend is effectively zero for the week) skip
 * the AI call entirely (both summary AND insights) and get a fixed,
 * data-substituted template instead: there's nothing real to summarize, and
 * asking an LLM to write about a paused campaign tends to either
 * hallucinate detail or produce an oddly-worded "no data" paragraph — a
 * fixed, deliberately-worded paragraph reads better and costs nothing per
 * campaign. This is a per-slide check (product decision), not
 * account-wide: one paused campaign among several active ones only
 * replaces that one slide's copy. See isPausedZeroResults's own doc
 * comment for the exact isInactive/hasResults gating.
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
 * A THIRD case (Fix 6, extended by Fix 4): a slide with real spend/delivery
 * but exactly zero results this week (a lead-gen campaign that hasn't
 * converted yet, say). CPR is mathematically undefined at zero results, so
 * it always renders as "—" (see report-data.ts/objective.ts), and the AI
 * plugging that dash straight into the summary prompt's "at a [CPR] cost"
 * phrasing produced nonsensical sentences like "generated 0 website leads
 * at a — cost" (the actual reported bug). Handled the same way as the
 * paused case — a deterministic sentence, no AI call for either summary or
 * insights — but with its own wording (buildZeroResultsSummary) that never
 * mentions CPR at all, rather than reusing the paused-campaign copy, since
 * "no results yet" and "no delivery at all" are different, both-true-ish-
 * often states that shouldn't read identically to the client.
 */

import type { AiContext, Platform, ReportData } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/slide-keys";
import { AI_UNAVAILABLE_TEXT, callAI, type AiKeys } from "./client";
import { buildGoogleAdsInsightPrompt, buildGoogleAdsSummaryPrompt } from "./google-prompts";
import {
  buildFallbackInsights,
  buildFallbackSummary,
  buildInsightPrompt,
  buildPausedZeroResultsInsights,
  buildPausedZeroResultsSummary,
  buildSummaryPrompt,
  buildZeroResultsSummary,
  capInsights,
  capSummary,
  countSentenceEndings,
  insightsLooksLikeLaundryList,
  resultCountMismatch,
} from "./prompts";

// Sub-cent spend is treated as zero — CSV/currency rounding can leave a
// fractional cent on an otherwise-inactive campaign, and that's still
// "paused," not "spent something."
const ZERO_SPEND_THRESHOLD = 0.01;

// The prompts ask for exactly 2 sentences (summary) / exactly 3 (insights) —
// the final safety net's "does this actually read as N complete sentences"
// check uses these as its threshold.
const MIN_SUMMARY_SENTENCES = 2;
const MIN_INSIGHTS_SENTENCES = 2;

function isZeroSpend(ctx: AiContext): boolean {
  return ctx.spendNum < ZERO_SPEND_THRESHOLD;
}

/**
 * Fix 4 — true when this slide should get the PAUSED copy. Two independent
 * triggers, matched to the two ways a campaign reads as "paused" for the
 * week:
 *  - Effectively zero spend (the original, pre-Fix-4 signal) — fires
 *    unconditionally, same as before. A $0-spend week has nothing to
 *    report regardless of what `results` happens to hold.
 *  - The CSV's own delivery_status column reports Paused/Inactive
 *    (AiContext.isInactive) AND this slide recorded no results this week —
 *    per the product spec, gated on !hasResults specifically: a campaign
 *    the CSV marks inactive but that still recorded real results this week
 *    (e.g. paused partway through, after already converting) has real
 *    performance worth describing, so THAT case falls through to the
 *    normal AI flow instead of the paused template.
 */
function isPausedZeroResults(ctx: AiContext): boolean {
  return isZeroSpend(ctx) || (ctx.isInactive && !ctx.hasResults);
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
function isUnusableAi(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  return !t || t === AI_UNAVAILABLE_TEXT || t.includes("[AI unavailable");
}

function endsComplete(trimmedText: string): boolean {
  return trimmedText.endsWith(".");
}

/** Picks the platform-appropriate prompt-builder pair — see google-prompts.ts's own doc comment for why only the prompt templates themselves (not the surrounding fallback/cap/truncation-safety-net logic below, which is already generic over AiContext) need a Google Ads variant. */
function promptBuildersFor(platform: Platform): { summary: typeof buildSummaryPrompt; insight: typeof buildInsightPrompt } {
  return platform === "GOOGLE"
    ? { summary: buildGoogleAdsSummaryPrompt, insight: buildGoogleAdsInsightPrompt }
    : { summary: buildSummaryPrompt, insight: buildInsightPrompt };
}

export async function generateInsights(data: ReportData, keys: AiKeys): Promise<Map<string, AiCopy>> {
  const slides = [...data.campaignSlides, ...data.adSetSlides];
  const results = new Map<string, AiCopy>();
  const { summary: buildSummaryPromptFor, insight: buildInsightPromptFor } = promptBuildersFor(data.platform);

  await Promise.all(
    slides.map(async (slide) => {
      const name = slide.campaignName;

      // Fix 4 — paused/inactive (or effectively zero-spend) with no results
      // this week: fixed copy, used verbatim, never sent to the AI at all
      // (neither summary nor insights) — see isPausedZeroResults's own doc
      // comment. Not run through capSummary/capInsights, which exist only
      // to bound unpredictable AI output.
      if (isPausedZeroResults(slide.ai)) {
        results.set(slideAiKey(slide), {
          summary: buildPausedZeroResultsSummary(slide.ai),
          insights: buildPausedZeroResultsInsights(),
        });
        return;
      }

      const zeroResults = isZeroResults(slide.ai);

      // Fix 4 — never call the AI for a zero-results slide (either sub-call):
      // there's no real result to describe, and asking the model to write
      // around a "—"/undefined cost-per-result invites exactly the kind of
      // hallucinated or nonsensical phrasing this fix exists to prevent.
      const [rawSummary, rawInsight] = await Promise.all([
        zeroResults ? Promise.resolve(null) : callAI(buildSummaryPromptFor(slide.ai), keys),
        zeroResults ? Promise.resolve(null) : callAI(buildInsightPromptFor(slide.ai), keys),
      ]);

      let summary: string;
      let summaryFallback: boolean;
      if (zeroResults) {
        summary = buildZeroResultsSummary(slide.ai);
        summaryFallback = false; // deliberate, structured copy — not a truncation recovery
      } else {
        const trimmedSummary = rawSummary!.trim();
        const countMismatch = resultCountMismatch(trimmedSummary, slide.ai.resultsNum);
        summaryFallback = isUnusableAi(trimmedSummary) || !endsComplete(trimmedSummary) || countMismatch;
        if (countMismatch) {
          console.warn(`[ai:generate-insights] AI summary result count mismatch for ${name} — forcing structured fallback`);
        }
        summary = summaryFallback ? buildFallbackSummary(slide.ai) : capSummary(trimmedSummary);
      }

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

      let insights: string;
      let insightsFallback: boolean;
      if (zeroResults) {
        // Fix 4 — never sent to the AI (rawInsight is null here); the same
        // data-driven fallback template used for a truncated response is
        // reused here too, since it already handles a "—"/zero result count
        // honestly without inventing detail.
        insights = buildFallbackInsights(slide.ai);
        insightsFallback = false; // deliberate, structured copy — not a truncation recovery
      } else {
        const trimmedInsight = rawInsight!.trim();
        insightsFallback =
          isUnusableAi(trimmedInsight) || !endsComplete(trimmedInsight) || insightsLooksLikeLaundryList(trimmedInsight);
        insights = insightsFallback ? buildFallbackInsights(slide.ai) : capInsights(trimmedInsight);
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
