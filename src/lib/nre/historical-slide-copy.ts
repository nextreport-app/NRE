/**
 * Deterministic, past-tense slide copy for Multi-Month Historical reports.
 * Summaries and observations describe the selected month, including MTD.
 * No provider call or unsupported performance judgement is needed.
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
  const observations: string[] = [];
  const available = (value: string) => /\d/.test(value) && !/N\/A/i.test(value);
  if (available(results) && slide.ai.resultsNum === 0 && slide.ai.spendNum > 0) {
    observations.push(`No ${resultLabel} were recorded for this period despite ${spend} in spend; cost per result is not applicable.`);
  } else if (slide.ai.resultsNum > 0) {
    observations.push(`${results} ${resultLabel} were recorded${cprPart}.`);
  } else {
    observations.push(`Recorded ad spend for this period was ${spend}.`);
  }
  if (available(slide.metrics.ctr)) observations.push(`CTR (all) was ${slide.metrics.ctr}${available(slide.metrics.cpc) ? `, with CPC (all) of ${slide.metrics.cpc}` : ""}.`);
  else if (available(slide.metrics.cpc)) observations.push(`CPC (all) was ${slide.metrics.cpc}.`);
  if (monthLabel.includes("(MTD)")) observations.push("This is month-to-date performance through the selected end date, rather than a complete month.");
  const insights = observations.join("\n");

  if (slide.isMonthTotal) {
    return {
      summary: `Combined across all campaigns, ${monthLabel} delivered ${spend} in ad spend and ${results} ${resultLabel}${cprPart}.`,
      insights,
    };
  }

  return {
    summary: `${slide.campaignName} spent ${spend} in ${monthLabel} and recorded ${results} ${resultLabel}${cprPart}.`,
    insights,
  };
}
