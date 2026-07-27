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
 */

import type { AiContext, ReportData } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/render";
import { callAI, type AiKeys } from "./client";
import { buildInsightPrompt, buildSummaryPrompt, capInsights, capSummary } from "./prompts";

// Sub-cent spend is treated as zero — CSV/currency rounding can leave a
// fractional cent on an otherwise-inactive campaign, and that's still
// "paused," not "spent something."
const ZERO_SPEND_THRESHOLD = 0.01;

const PAUSED_SUMMARY_TEXT =
  "This campaign was inactive during the reporting period with no spend, reach, or impressions recorded. The campaigns are currently paused pending further instructions. Performance data will resume once campaigns are reactivated.";

const PAUSED_INSIGHTS_TEXT =
  "Campaigns remained paused this week with no activity recorded. No optimisation actions were taken during this period. Once campaigns are reactivated, we will monitor performance closely and provide a full update in the following week's report.";

function isZeroSpend(ctx: AiContext): boolean {
  return ctx.spendNum < ZERO_SPEND_THRESHOLD;
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
      results.set(slideAiKey(slide), {
        summary: capSummary(rawSummary),
        insights: capInsights(rawInsight),
      });
    }),
  );

  return results;
}
