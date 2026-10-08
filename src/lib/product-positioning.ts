/**
 * Public positioning copy — homepage, about, wizard, and launch pages.
 * Keep Meta CSV v1 claims aligned with /help/download.
 */

/** Hero / homepage — time → money (no geo-specific rates). */
export const SPECIALIST_TIME_SAVINGS_LINE =
  "Every automated report saves about 15–25 minutes of specialist time. At typical agency billing rates, that adds up to meaningful capacity each month — not just a shorter Friday.";

export const PRODUCT_ELEVATOR_PITCH =
  "NextReport turns your Meta Ads Manager CSV into the branded weekly deck you’d normally build in PowerPoint — with AI summaries — in about two minutes. Built for agencies, not client dashboards.";

export const PRODUCT_DIFFERENTIATOR_LINE =
  "Upload the same export you already pull from Ads Manager; get the deck you would have built by hand — with AI summary — in minutes.";

export const META_V1_PROMISE_HEADLINE = "What’s live today (Meta CSV v1)";

export const META_V1_PROMISE_BULLETS = [
  "Report types: Weekly, Monthly, Yesterday (single day), Comparison, Multi-Month Historical, and Day-by-Day Table.",
  "Export: Meta Ads Manager → Campaigns (or Ad Sets) → Export table data → CSV.",
  "Date range: Last 30 days with Day breakdown (recommended), or Previous Month for month-end reporting.",
  "Columns: Campaign name, Day, Result type, Results, Amount spent, Cost per result, Reach, Impressions, CTR, Link clicks — plus lead/traffic fields your objective needs (see CSV Export Guide).",
  "Objectives: Lead gen, traffic, sales, reach, engagement, and messaging — auto-detected; you confirm in the wizard.",
  "Numbers come straight from your CSV rows; totals should match Ads Manager for the same dates and export level.",
] as const;

export const REFERRAL_PROGRAM_LINE =
  "Refer another agency: when they subscribe, you both get one free month on your next renewal.";

export const WHATSAPP_COMMUNITY_LINE =
  "Indian agencies: chat with us on WhatsApp for setup help, reporting tips, and early feature news.";

/** Anonymized founder case study for About + launch story. */
export const FOUNDER_CASE_STUDY = {
  headline: "From the founder’s desk (anonymized)",
  body:
    "Remote Meta specialist at a US agency — 25+ ad accounts, 5–6 client decks per day. Manual PPT updates took about 20–30 minutes each (~2–3 hours daily). First internal runs with NextReport cut that to under 5 minutes per report for standard weekly decks.",
  stats: ["~22 min saved per report", "6+ clients / day reporting load", "US agency workflow, built in India"],
} as const;
