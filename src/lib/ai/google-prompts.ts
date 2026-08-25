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

/** Fix 3 — same "don't repeat the date/campaign name already on the slide" instruction as prompts.ts's own buildSummaryPrompt, with Google Ads metric wording (conversions/cost per conversion/avg. CPC instead of results/CPR/CPC). */
export function buildGoogleAdsSummaryPrompt(ctx: AiContext): string {
  return (
    "Write a campaign performance summary. Write exactly 2 sentences. Do NOT start with the date range or campaign name — those are already shown on the slide.\n" +
    "Do NOT re-list every card metric unless you are comparing two figures.\n" +
    "Sentence 1: What the campaign is for and the one conversion or click result that matters.\n" +
    "Sentence 2: One efficiency read (cost per conversion, CTR, or avg. CPC).\n" +
    "Rules:\n" +
    "- Never start with During [date] or The [campaign name] campaign\n" +
    "- Do NOT mention ad groups or delivery status\n" +
    "- Always use real numbers from the data\n" +
    "- Under 55 words total\n" +
    "- Professional tone\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Date: " + ctx.dateRange + ", Cost: " + ctx.spend + ", Clicks: " + ctx.reach +
    ", Impressions: " + ctx.impressions + ", Conversions: " + ctx.results + ", Cost per conversion: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", Avg. CPC: " + ctx.cpc
  );
}

export function buildGoogleAdsInsightPrompt(ctx: AiContext): string {
  return (
    "Write the Key Insights section for a Google Ads weekly client report. Write exactly 2 sentences.\n" +
    "Sentence 1: One data read — cite at most one or two real figures.\n" +
    "Sentence 2: One next step that follows from that read. Do not list four generic actions (budget, pause, new copy, targeting) as a laundry list.\n" +
    "Rules:\n" +
    "- Always use actual numbers from the data when you cite them\n" +
    "- Do not use bullet points, headers, dashes, or line breaks\n" +
    "- Keep total length under 60 words\n" +
    "- Do not start with This week or During this period\n" +
    "- Do NOT mention ad groups or delivery status\n" +
    "- Sound like a senior account manager giving honest advice\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Cost: " + ctx.spend + ", Clicks: " + ctx.reach +
    ", Conversions: " + ctx.results + ", Cost per conversion: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", Avg. CPC: " + ctx.cpc
  );
}
