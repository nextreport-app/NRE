/**
 * TikTok Ads AI prompt construction — TikTok-specific wording only.
 * Does NOT reuse Meta instant-form / pixel rules (see prompts.ts, gated to META).
 * AiContext fields: spend, reach (real reach), impressions, results, cpr, ctr, cpc.
 */

import type { AiContext } from "../nre/report-data";

export function buildTikTokSummaryPrompt(ctx: AiContext): string {
  return (
    "Write a campaign performance summary for a TikTok Ads weekly client report. Write exactly 2 sentences. Do NOT start with the date range or campaign name — those are already shown on the slide.\n" +
    "Do NOT re-list every card metric unless you are comparing two figures.\n" +
    "Sentence 1: What the campaign is for and the one result that matters (conversions, reach, or link clicks).\n" +
    "Sentence 2: One efficiency read (cost per result, CTR, or CPC).\n" +
    "Rules:\n" +
    "- Never start with During [date] or The [campaign name] campaign\n" +
    "- Do NOT mention ad groups or delivery status\n" +
    "- Do NOT mention Meta, Facebook, Instagram, pixel, or instant forms\n" +
    "- Always use real numbers from the data\n" +
    "- Under 55 words total\n" +
    "- Professional tone\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Date: " + ctx.dateRange + ", Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", Impressions: " + ctx.impressions + ", Results: " + ctx.results + ", Cost per result: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc
  );
}

export function buildTikTokInsightPrompt(ctx: AiContext): string {
  return (
    "Write the Key Insights section for a TikTok Ads weekly client report. Write exactly 2 sentences.\n" +
    "Sentence 1: One data read — cite at most one or two real figures.\n" +
    "Sentence 2: One next step that follows from that read. Do not list four generic actions as a laundry list.\n" +
    "Rules:\n" +
    "- Always use actual numbers from the data when you cite them\n" +
    "- Do not use bullet points, headers, dashes, or line breaks\n" +
    "- Do NOT mention Meta, Facebook, Instagram, pixel, or instant forms\n" +
    "- Keep total length under 60 words\n" +
    "- Do not start with This week or During this period\n" +
    "- Do NOT mention ad groups or delivery status\n" +
    "- Sound like a senior account manager giving honest advice\n\n" +
    "Data: Campaign: " + ctx.ctx + ", Spend: " + ctx.spend + ", Reach: " + ctx.reach +
    ", Results: " + ctx.results + ", Cost per result: " + ctx.cpr +
    ", CTR: " + ctx.ctr + ", CPC: " + ctx.cpc
  );
}
