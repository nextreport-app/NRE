import { forEachConcurrent } from "@/lib/for-each-concurrent";
import { assertReportComplexity } from "@/lib/report-complexity";
import type { AiContext, ReportData } from "../nre/report-data";
import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/slide-keys";
import { callAI, type AiKeys } from "./client";
import {
  buildReportCommentary, cachedCommentaryAction, commentarySelectionPrompt,
  selectedCommentaryAction, shouldSelectCommentaryAction,
} from "./report-commentary";

function contextForSlide(slide: ReportData["campaignSlides"][number] | ReportData["adSetSlides"][number]): AiContext {
  return {...slide.ai,entityLabel:slide.kind === "campaign" ? "campaign" : slide.ai.entityLabel === "ad group" ? "ad group" : "ad set"};
}

/** Fresh and warmed reports use the same fact/action contract for every client. */
export function revalidateCachedInsights(data: ReportData, copy: ReadonlyMap<string,AiCopy>): Map<string,AiCopy> {
  return new Map([...data.campaignSlides,...data.adSetSlides].map(slide => {
    const key=slideAiKey(slide);
    const ctx=contextForSlide(slide);
    return [key,buildReportCommentary(ctx,data.platform,cachedCommentaryAction(copy.get(key),ctx,data.platform))];
  }));
}

export async function generateInsights(data: ReportData, keys: AiKeys): Promise<Map<string,AiCopy>> {
  assertReportComplexity(data);
  const results=new Map<string,AiCopy>();
  await forEachConcurrent([...data.campaignSlides,...data.adSetSlides],2,async slide => {
    const ctx=contextForSlide(slide);
    let actionId: string | undefined;
    if (shouldSelectCommentaryAction(ctx) && (keys.anthropicApiKey || keys.groqApiKey || keys.geminiApiKey)) {
      try {
        actionId=selectedCommentaryAction(await callAI(commentarySelectionPrompt(ctx,data.platform),keys),ctx);
      } catch {
        // An unavailable provider must not prevent generation of truthful report copy.
      }
    }
    results.set(slideAiKey(slide),buildReportCommentary(ctx,data.platform,actionId));
  });
  return results;
}
