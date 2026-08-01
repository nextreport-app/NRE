/**
 * Google Ads AI prompt construction — the Google Ads counterpart to
 * prompts.ts's Meta prompt builders. Same AiContext shape (report-data.ts's
 * spend/reach/impressions/results/cpr/ctr/cpc fields, repurposed by
 * google-report-data.ts to hold cost/clicks/impressions/conversions/
 * cost-per-conversion/ctr/avg-CPC) and the exact same fallback/cap/
 * sentence-counting safety net in prompts.ts (those are already generic
 * over AiContext, not Meta-specific — only the two prompt template strings
 * themselves need Google Ads wording).
 */

import type { AiContext } from "../nre/report-data";

/** Wording per spec: "During [dateRange], the [campaignName] campaign generated [conversions] conversions at a [costPerConv] cost per conversion, with [clicks] clicks from [impressions] impressions. The campaign achieved a [ctr]% click-through rate at [avgCpc] average CPC." */
export function buildGoogleAdsSummaryPrompt(ctx: AiContext): string {
  return (
    "Write a campaign performance summary for a Google Ads weekly client report. Write exactly 2 sentences following this structure:\n" +
    "Sentence 1: During [date range], the [campaign name] campaign generated [conversions] conversions at a [cost per conversion] cost per conversion, with [clicks] clicks from [impressions] impressions.\n" +
    "Sentence 2: The campaign achieved a [CTR]% click-through rate at [average CPC] average CPC, reflecting [positive/neutral/cautious] audience engagement this week.\n" +
    "Rules:\n" +
    "- Always use the real numbers provided — never invent or estimate\n" +
    "- If a metric is zero or unavailable use the word zero or not available\n" +
    "- Do not add any text before or after the two sentences\n" +
    "- Do not use bullet points, headers, or line breaks\n" +
    "- Keep total length under 60 words\n" +
    "- Sound professional and factual, like a senior account manager\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Date: " + ctx.dateRange + ", Cost: " + ctx.spend + ", Clicks: " + ctx.reach +
    ", Impressions: " + ctx.impressions + ", Conversions: " + ctx.results + ", Cost per conversion: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", Avg. CPC: " + ctx.cpc
  );
}

/** Same 3-sentence structure as Meta's buildInsightPrompt (per spec: "Same structure as Meta"), with Google Ads metric wording. */
export function buildGoogleAdsInsightPrompt(ctx: AiContext): string {
  return (
    "Write the Key Insights and Next Strategy section for a Google Ads weekly client report. Write exactly 3 sentences following this structure:\n" +
    "Sentence 1: One specific insight about what performed well or what the data shows this week — cite a real metric number.\n" +
    "Sentence 2: One specific insight about what needs attention or a notable trend — cite a real metric number.\n" +
    "Sentence 3: The recommended next actions — always include: allocating budget toward top-performing keywords/ads, pausing underperformers, testing new ad copy, and refining targeting or bidding strategy.\n" +
    "Rules:\n" +
    "- Always cite actual numbers from the data provided\n" +
    "- Do not use bullet points, headers, dashes, or line breaks\n" +
    "- Keep total length under 75 words\n" +
    "- Do not start with This week or During this period — vary the opening\n" +
    "- Sound like a senior account manager giving honest strategic advice\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Cost: " + ctx.spend + ", Clicks: " + ctx.reach +
    ", Conversions: " + ctx.results + ", Cost per conversion: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", Avg. CPC: " + ctx.cpc
  );
}
