/**
 * Public positioning copy — homepage, about, wizard, and launch pages.
 * Keep Meta CSV v1 claims aligned with /help/download.
 */

/** Bottom-of-page and how-it-works closing CTA headline. */
export const MARKETING_TRY_CTA_HEADLINE = "Try NextReport now.";

/** Homepage hero — one line (Cursor-style). */
export const PRODUCT_HERO_HEADLINE = "Branded client reporting for agencies in minutes.";

/** Hero / homepage — time → money (no geo-specific rates). */
export const SPECIALIST_TIME_SAVINGS_LINE =
  "Every automated report saves about 15–25 minutes of specialist time. At typical agency billing rates, that adds up to meaningful capacity each month — not just a shorter Friday.";

export const PRODUCT_ELEVATOR_PITCH =
  "NextReport turns your Meta Ads Manager CSV into the branded weekly deck you’d normally build in PowerPoint — with AI summaries — in about two minutes. Built for agencies, not client dashboards.";

export const PRODUCT_DIFFERENTIATOR_LINE =
  "Upload the same export you already pull from Ads Manager; get the deck you would have built by hand — with AI summary — in minutes.";

export const META_V1_PROMISE_HEADLINE = "What’s live today (Meta CSV)";

export const META_V1_PROMISE_BULLETS = [
  "Live now: Meta Ads — weekly, monthly, yesterday, comparison, historical, and day-by-day table reports from a day-wise CSV export.",
  "Launching soon: Meta Marketing API sync, Google Ads, TikTok Ads, and GA4 website reporting (available for testing on some accounts — not production launch).",
  "Export: Meta Ads Manager → Reports → Export table data → CSV (Day breakdown — not the Campaigns-screen export).",
  "Date range: Last 30 days with Day breakdown (recommended), or Previous Month for month-end reporting.",
  "Objectives auto-detected from your CSV; confirm in the wizard when needed.",
  "Numbers come straight from your CSV rows; totals should match Ads Manager for the same dates and export level.",
] as const;

export const REFERRAL_PROGRAM_LINE =
  "Refer another agency: when they subscribe, you both get one free month on your next renewal.";

export const WHATSAPP_COMMUNITY_LINE =
  "Indian agencies: chat with us on WhatsApp for setup help, reporting tips, and early feature news.";

/** About page — proof block (team voice, no individual backstory). */
export const ABOUT_OPERATIONS_PROOF = {
  headline: "Built with agency operators in the loop",
  body:
    "We are a small product team focused on one job: turn Meta Ads Manager exports into client-ready decks without rebuilding slides by hand. Every release is checked against real anonymized exports and automated regression tests so spend, results, and cost-per-result stay aligned with Ads Manager.",
  stats: ["Typical generate under 2 minutes", "CSV reconciliation in the wizard", "White-label decks, not client logins"],
} as const;
