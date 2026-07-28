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
 * Separately, a NON-zero-spend slide's AI response can still come back
 * truncated mid-sentence (e.g. "...achieved a 4.48% click-through rate and
 * a $2." with the actual CPC value cut off) — raising max_tokens doesn't
 * reliably fix this (500 was already generous for a 2-3 sentence response,
 * yet truncation still happened), so instead every response is checked for
 * a trailing period after the AI call: a response that doesn't end with one
 * is discarded outright in favor of a deterministic, data-only fallback
 * sentence (buildFallbackSummary/buildFallbackInsights) that can't itself
 * be cut off, since it's built from values already on hand rather than
 * generated token-by-token.
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
  capInsights,
  capSummary,
} from "./prompts";

// Sub-cent spend is treated as zero — CSV/currency rounding can leave a
// fractional cent on an otherwise-inactive campaign, and that's still
// "paused," not "spent something."
const ZERO_SPEND_THRESHOLD = 0.01;

const PAUSED_SUMMARY_TEXT =
  "This campaign was inactive during the reporting period with no spend, reach, or impressions recorded. The campaign is currently paused pending further instructions.";

const PAUSED_INSIGHTS_TEXT =
  "The campaign remained inactive this week with no delivery or spend recorded. Once reactivated, budget will be directed toward top-performing creatives while underperformers are paused, with targeting refined to improve overall efficiency.";

function isZeroSpend(ctx: AiContext): boolean {
  return ctx.spendNum < ZERO_SPEND_THRESHOLD;
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
      if (isZeroSpend(slide.ai)) {
        // Fixed copy, used verbatim — not run through capSummary/capInsights,
        // which exist only to bound unpredictable AI output.
        results.set(slideAiKey(slide), { summary: PAUSED_SUMMARY_TEXT, insights: PAUSED_INSIGHTS_TEXT });
        return;
      }

      const [rawSummary, rawInsight] = await Promise.all([
        callAI(buildSummaryPrompt(slide.ai), keys),
        callAI(buildInsightPrompt(slide.ai), keys),
      ]);

      // Trailing whitespace (the AI sometimes appends a stray space after
      // the last character) would otherwise make a complete response look
      // truncated to an endsComplete() check — trim before checking.
      const trimmedSummary = rawSummary.trim();
      let summary: string;
      if (endsComplete(trimmedSummary)) {
        summary = capSummary(trimmedSummary);
      } else {
        console.warn(`[ai:generate-insights] AI summary truncated for ${slide.campaignName} — using structured fallback`);
        summary = buildFallbackSummary(slide.ai);
      }

      const trimmedInsight = rawInsight.trim();
      let insights: string;
      if (endsComplete(trimmedInsight)) {
        insights = capInsights(trimmedInsight);
      } else {
        console.warn(`[ai:generate-insights] AI insights truncated for ${slide.campaignName} — using structured fallback`);
        insights = buildFallbackInsights(slide.ai);
      }

      results.set(slideAiKey(slide), { summary, insights });
    }),
  );

  return results;
}
