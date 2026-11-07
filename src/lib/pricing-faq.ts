/** Pricing page FAQ — keep in sync with product (platforms, wizard, billing). */
export const PRICING_FAQS = [
  {
    q: "Which platforms are live today?",
    a: "Meta Ads reporting is live through CSV upload or read-only Meta API sync, included in every plan. Generate weekly, monthly, comparison and daily reports. Google Ads, TikTok Ads and GA4 reporting are coming soon.",
  },
  {
    q: "Is there really no credit card required for the free trial?",
    a: "Correct. Sign up and get 7 days to try reporting with up to 3 clients and 10 generated reports with no payment details required. You only need to subscribe when your trial ends and you want to continue.",
  },
  {
    q: "What's the difference between Freelancer, Agency and Agency Plus?",
    a: "All three plans include unlimited report generation subject to fair use and generation concurrency safeguards, Meta CSV upload and API sync, white-label options, Slack/Zapier webhooks, and client sharing tools. Freelancer supports up to 10 client workspaces, Agency up to 50, and Agency Plus up to 100. All three are available through self-service checkout. Priority email support is included on Agency and Agency Plus. Contact us for more than 100 clients.",
  },
  {
    q: "Do you charge my card automatically each month?",
    a: "Recurring subscriptions renew each billing period through Razorpay until you cancel from Billing. A one-time checkout purchases only the displayed month or year and does not renew automatically. Cancellation stops future renewal; already paid access lasts until the paid-through date. We never store your card on our servers. Cancel anytime.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You will see a prompt to subscribe. If you choose not to subscribe, you cannot generate new reports, but your account and clients remain accessible; generated reports remain available only within your selected retention window.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. Review your plan from Billing. For launch, contact support for a paid-plan change so you are not charged twice. New subscriptions and renewals apply their stated active-client limits.",
  },
  {
    q: "Can I connect ad platforms directly instead of uploading a CSV?",
    a: "Yes. Connect Meta Ads in Account Settings, then choose API sync in the report wizard and select an ad account. API sync uses read-only access and follows the same report setup and calculations as CSV upload. You can switch methods at any time.",
  },
  {
    q: "Can I white-label reports for my clients?",
    a: "Yes — included on the free trial and all three paid plans. In Account settings, show NextReport (default), replace it with your agency name on shared links and client emails, or hide third-party branding entirely.",
  },
  {
    q: "What currencies do you support?",
    a: "INR and USD pricing. Razorpay checkout supports UPI, cards, and net banking in India; international cards for USD.",
  },
  {
    q: "Are reports unlimited, and how long are they stored?",
    a: "Paid plans have no monthly report quota. One report generates at a time per account, and shared capacity may temporarily ask you to retry. Each report supports up to 50 campaign/ad-set detail slides and day-wise CSVs up to 32 MB when lossless compression fits the 4 MB request limit; otherwise export a shorter range. Technical upload/sync limits are 20 per day during trial and 100 per day on paid plans; contact us for bulk needs. The trial includes 10 reports. Report storage defaults to 7 days; download reports you need to keep. Automated bulk generation, account resale and sharing one workspace across unrelated agencies are not included. Contact us for high-volume use.",
  },
  {
    q: "Is my data secure?",
    a: "Reports and uploads are stored on encrypted infrastructure. We do not sell client data. See our Privacy Policy for retention and deletion.",
  },
];
