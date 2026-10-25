/**
 * Public positioning copy — homepage, about, wizard, and launch pages.
 * Keep claims aligned with /help/download and live platform scope.
 */

/** Bottom-of-page and how-it-works closing CTA headline. */
export const MARKETING_TRY_CTA_HEADLINE = "Try NextReport now.";

/** Homepage hero — one line (Cursor-style). */
export const PRODUCT_HERO_HEADLINE = "Branded client reporting for agencies in minutes.";

/** Hero / homepage — time → money (no geo-specific rates). */
export const SPECIALIST_TIME_SAVINGS_LINE =
  "Every automated report saves about 15–25 minutes of specialist time. At typical agency billing rates, that adds up to meaningful capacity each month — not just a shorter Friday.";

export const PRODUCT_ELEVATOR_PITCH =
  "NextReport turns ad platform exports — or API sync — into the branded weekly deck you’d normally build in PowerPoint, with AI summaries, in about two minutes. Meta, Google Ads, TikTok, and GA4 website reporting in one workflow.";

export const PRODUCT_DIFFERENTIATOR_LINE =
  "Upload the CSV you already export from Ads Manager or Google Ads — or sync from API — and get the deck you would have built by hand, with an AI summary, in minutes.";

export const META_V1_PROMISE_HEADLINE = "What’s included";

export const META_V1_PROMISE_BULLETS = [
  "Platforms: Meta Ads, Google Ads, TikTok Ads (CSV or API sync), and GA4 website traffic reports.",
  "Report types: Weekly, Monthly, Yesterday, Comparison, Multi-Month Historical, Day-by-Day Table, Quarterly, YTD, and Creative (ad-level).",
  "Meta export: Ads Manager → Reports → Export table data → CSV (Day breakdown). Google/TikTok: use the platform export or Sync from API when connected.",
  "Connect accounts in Settings for read-only API import (Meta, Google Ads, TikTok, GA4) — or stay on CSV-only upload.",
  "Objectives auto-detected from your data; confirm in the wizard when needed.",
  "Numbers come from your export or API rows; totals should match the native platform UI for the same dates.",
] as const;

export const REFERRAL_PROGRAM_LINE =
  "Refer another agency: when they subscribe, you both get one free month on your next renewal.";

export const WHATSAPP_COMMUNITY_LINE =
  "Indian agencies: chat with us on WhatsApp for setup help, reporting tips, and early feature news.";

/** About page — proof block (team voice, no individual backstory). */
export const ABOUT_OPERATIONS_PROOF = {
  headline: "Built with agency operators in the loop",
  body:
    "We are a small product team focused on one job: turn ad platform and GA4 data into client-ready decks without rebuilding slides by hand. Every release is checked against real anonymized exports and automated regression tests so spend, results, and cost-per-result stay aligned with the source platform.",
  stats: ["Typical generate under 2 minutes", "CSV reconciliation in the wizard", "White-label decks, not client logins"],
} as const;
