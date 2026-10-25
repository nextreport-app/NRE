/** Pricing page FAQ — keep in sync with product (platforms, wizard, billing). */
export const PRICING_FAQS = [
  {
    q: "Which platforms are live today?",
    a: "Meta Ads, Google Ads, TikTok Ads, and GA4 website reporting — CSV upload or read-only API sync from Account settings. Report types include weekly, monthly, daily, comparison, historical, day-breakdown, quarterly, YTD, and creative (ad-level). All platforms are included in your plan with no extra per-platform fee.",
  },
  {
    q: "Is there really no credit card required for the free trial?",
    a: "Correct. Sign up and get 7 days of full access with no payment details required. You only need to subscribe when your trial ends and you want to continue.",
  },
  {
    q: "What's the difference between Agency and Professional?",
    a: "Both plans include unlimited report generation, all ad platforms and GA4, white-label options, and Slack/Zapier webhooks. Agency supports up to 10 client workspaces; Professional is unlimited clients for larger rosters. Priority email support is on Professional.",
  },
  {
    q: "Do you charge my card automatically each month?",
    a: "Yes — subscriptions renew automatically each billing period (monthly or annual) through Razorpay until you cancel from Billing. We never store your card on our servers. Cancel anytime.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You will see a prompt to subscribe. If you choose not to subscribe, you cannot generate new reports, but your account, clients, and report history remain accessible.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Upgrade or downgrade from Billing. Changes take effect immediately; client limits apply to active workspaces on Agency.",
  },
  {
    q: "Can I connect ad platforms directly instead of uploading a CSV?",
    a: "Yes. Connect Meta, Google Ads, or TikTok in Account settings and use Sync from API in the wizard, or upload a CSV export from each platform. CSV remains the best parity check against the native UI; API sync is read-only.",
  },
  {
    q: "What file formats can I upload?",
    a: "CSV, Excel (.xlsx, .xls), TSV, and TXT. Export from Meta Ads Reporting with Day breakdown — no conversion needed.",
  },
  {
    q: "How many reports can I generate per month?",
    a: "Unlimited on both plans. No per-report charges.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Choose Annual on the pricing page and save 20% versus paying monthly (one payment for 12 months).",
  },
  {
    q: "Can I connect Slack or Zapier?",
    a: "Yes. In Account settings, add a Slack incoming webhook or automation webhook (Zapier, Make, etc.). When a report finishes generating, NextReport can post a summary and share link.",
  },
  {
    q: "Is my client data secure?",
    a: "CSV data is processed to generate your report over HTTPS. Raw upload files are not kept indefinitely after generation completes. See our Privacy Policy for retention details.",
  },
  {
    q: "Can I hide NextReport branding on client reports?",
    a: "Yes — on every plan, including the trial. In Account settings, show NextReport (default), replace with your agency name on share links and emails, or hide third-party branding. Cover slides use your agency name when set.",
  },
  {
    q: "Do you offer an Enterprise plan?",
    a: "We keep pricing simple with Agency and Professional plus a 7-day trial. For custom billing, onboarding, or rollout across offices, email hello@nextreport.in.",
  },
] as const;
