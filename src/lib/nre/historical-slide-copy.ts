/**
 * Deterministic, past-tense slide copy for Multi-Month Historical reports.
 * Historical months are closed — summaries describe what happened; insights
 * stay minimal (no forward-looking recommendations).
 */

import type { CampaignSlideData } from "./report-data";
import type { AiCopy } from "../pptx/fill-tags";

function cprPhrase(cpr: string, resultLabel: string): string {
  if (!cpr || cpr === "—" || cpr === "N/A") return "";
  const singular = resultLabel.toLowerCase().replace(/s$/, "");
  return ` at ${cpr} per ${singular}`;
}

/** Builds campaign- or month-total-specific summary + minimal insights. */
export function buildHistoricalSlideCopy(slide: CampaignSlideData): AiCopy {
  const monthLabel = slide.ai.dateRange || "this period";
  const spend = slide.metrics.spend;
  const results = slide.metrics.results;
  const resultLabel = slide.resultLabel.toLowerCase();
  const cprPart = cprPhrase(slide.metrics.cpr, slide.resultLabel);

  if (slide.isMonthTotal) {
    return {
      summary: `Combined across all campaigns, ${monthLabel} delivered ${spend} in ad spend and ${results} ${resultLabel}${cprPart}.`,
      insights: "Historical data.",
    };
  }

  return {
    summary: `${slide.campaignName} spent ${spend} in ${monthLabel} and recorded ${results} ${resultLabel}${cprPart}.`,
    insights: "Historical data.",
  };
}
