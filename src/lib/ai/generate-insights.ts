/**
 * Orchestrates AI-written copy for every campaign/ad-set slide in a report.
 * One summary + one insights call per slide (matching writeInsights_, which
 * runs per-slide in the source too) — run concurrently since Node isn't
 * constrained by Apps Script's synchronous execution model; each slide's
 * pair of calls is independent and failures are isolated per slide.
 */

import type { ReportData } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/render";
import { callAI, type AiKeys } from "./client";
import { buildInsightPrompt, buildSummaryPrompt, capInsights, capSummary } from "./prompts";

export async function generateInsights(data: ReportData, keys: AiKeys): Promise<Map<string, AiCopy>> {
  const slides = [...data.campaignSlides, ...data.adSetSlides];
  const results = new Map<string, AiCopy>();

  await Promise.all(
    slides.map(async (slide) => {
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
