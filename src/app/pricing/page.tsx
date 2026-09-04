import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { CurrencyPricing } from "@/components/currency-pricing";
import { PricingCurrencyBanner } from "@/components/pricing-currency-banner";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Pricing",
  description:
    "Simple pricing for automated Meta and Google Ads reporting. Starter from $8/month, Professional from $20/month. 7-day free trial, live browser share link, and PDF download included.",
  path: "/pricing",
});

const FAQS = [
  {
    q: "Is there really no credit card required for the free trial?",
    a: "Correct. Sign up and get 7 days of full access with no payment details required. You only need to subscribe when your trial ends and you want to continue.",
  },
  {
    q: "What happens when my trial ends?",
    a: "You will see a prompt to subscribe. If you choose not to subscribe, you will not be able to generate new reports but your account and all your client data stays safe and accessible.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade at any time from your billing page. Changes take effect immediately.",
  },
  {
    q: "Can I connect Meta or Google Ads directly instead of uploading a CSV?",
    a: "Yes — NextReport syncs with Meta's Marketing API and Google's Ads API. Connect your accounts in Account Settings and choose Sync from API in the report wizard. CSV upload remains fully supported if you prefer manual exports.",
  },
  {
    q: "What file formats can I upload?",
    a: "NextReport accepts CSV, Excel (xlsx, xls), TSV, and TXT files. Download your report from Meta Ads Manager or Google Ads in any of these formats and upload directly — no conversion needed.",
  },
  {
    q: "Do I need to include specific columns in my CSV?",
    a: "For best results include: Campaign Name, Ad Set Name, Day, Result Type, Results, Amount Spent, Cost Per Result, CTR, CPC, Link Clicks, Reach, Impressions and Frequency. See our CSV Export Guide for the exact steps to download the right format from Meta and Google Ads.",
  },
  {
    q: "How many reports can I generate per month?",
    a: "Unlimited on both plans. Generate as many reports as you need for as many clients as your plan allows — no per-report charges.",
  },
  {
    q: "What is the difference between Meta Ads and Google Ads reporting?",
    a: "Both use the same dark navy branded template and AI-written insights. The metrics shown adapt automatically to the platform — Meta shows reach, frequency, leads and link clicks while Google shows clicks, impressions, conversions and quality score.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Yes. Switch to Annual on the pricing page and save 20% compared to paying monthly (one payment for 12 months of access).",
  },
  {
    q: "Can I connect Slack or Zapier?",
    a: "Yes. In Account settings, add a Slack incoming webhook URL or an automation webhook (Zapier, Make, etc.). When a report finishes generating, NextReport posts a summary and share link automatically.",
  },
  {
    q: "Is my client data secure?",
    a: "Yes. Your CSV data is processed on our servers and used only to generate your report. We do not store your raw campaign data after the report is generated. All data is transmitted over encrypted HTTPS connections.",
  },
];

export default async function PricingPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to NextReport
        </Link>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Simple, Transparent Pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink-muted">
            Everything you need to automate Meta and Google Ads reporting. Connect via official API or upload a CSV —
            then share a live browser link, download a PDF, or export PowerPoint.
          </p>
        </div>

        <PricingCurrencyBanner />

        <p className="mt-8 text-center text-xs text-ink-muted">
          ✓ 7-day free trial · ✓ No credit card required · ✓ Cancel anytime · ✓ Instant access
        </p>

        <CurrencyPricing loggedIn={loggedIn} userEmail={session?.user?.email} userName={session?.user?.name} />

        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold text-white">Frequently Asked Questions</h2>

          <div className="mx-auto mt-8 max-w-2xl space-y-3">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-lg border border-navy-border bg-navy-panel p-4 open:pb-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                  {faq.q}
                  <span className="ml-4 text-ink-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-secondary">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
