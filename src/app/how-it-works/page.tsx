import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { JsonLd } from "@/components/json-ld";
import { ProductExplainerAnimation } from "@/components/home/product-explainer-animation";
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  howToJsonLd,
  HOW_IT_WORKS_STEPS_SCHEMA,
  pageMetadata,
  PRODUCT_FAQ_SCHEMA,
} from "@/lib/seo";
import { MARKETING_TRY_CTA_HEADLINE } from "@/lib/product-positioning";
import { WIZARD_REPORT_TYPE_COPY } from "@/lib/nre/wizard-report-type-copy";
import type { LaunchEnabledReportType } from "@/lib/meta-launch-scope";

export const metadata: Metadata = pageMetadata({
  title: "How It Works — 4-Step Report Wizard",
  description:
    "Add a client, pick a report type, upload a day-wise Meta Ads Reporting CSV, and generate a branded .pptx or live share link in under 2 minutes.",
  path: "/how-it-works",
});

const SETUP_STEPS = [
  {
    title: "Create your free trial account",
    body: "Sign up in under a minute — no credit card required. You get 7 days to try the full wizard.",
  },
  {
    title: "Add a client with branding",
    body: "From My Clients, add the client name and upload their logo. Every slide and export uses that branding automatically.",
  },
  {
    title: "Optional: GA4 in Account Settings",
    body: "Website (GA4) reports connect here when they launch. Meta ad reports use a CSV from Meta Ads Reporting on Step 1 of the wizard today.",
  },
];

const REPORT_TYPE_ORDER: LaunchEnabledReportType[] = [
  "WEEKLY",
  "MONTHLY",
  "DAILY",
  "COMPARISON",
  "HISTORICAL",
  "DAY_BREAKDOWN",
];

interface Step {
  title: string;
  body: string;
  detail?: string;
}

const WIZARD_STEPS: Step[] = [
  {
    title: "Import",
    body: "Choose the report type first, then export the matching day-wise CSV from Meta Ads Reporting and upload it. Optional Previous Month CSV adds the prior-month row on weekly decks.",
    detail: "Step label in the app: Import",
  },
  {
    title: "Campaigns & objectives",
    body: "Select campaigns for this deck and confirm each campaign’s primary result objective (leads, purchases, traffic, reach, and more).",
    detail: "Step label in the app: Campaigns",
  },
  {
    title: "Review metrics",
    body: "Preview the KPI chips on each campaign slide. Remove metrics you do not need or add extras from columns in your export.",
    detail: "Step label in the app: Metrics",
  },
  {
    title: "Generate report",
    body: "Confirm dates and report type, then generate. Download .pptx (open in PowerPoint or Google Slides), share a live browser link, save to Google Drive, or send via WhatsApp or email.",
    detail: "Step label in the app: Generate",
  },
];

const OUTPUTS = [
  {
    icon: "📥",
    title: "Download as PowerPoint (.pptx)",
    description: "The format clients already expect — agency branding and AI-written insights on every slide.",
  },
  {
    icon: "🔗",
    title: "Share a live browser link",
    description: "Clients open the report on any device. No PowerPoint install required.",
  },
  {
    icon: "☁️",
    title: "Save to Google Drive",
    description: "Upload the deck to your folder and share from Drive.",
  },
  {
    icon: "💬",
    title: "Share via WhatsApp or Email",
    description: "One click from the generate screen after the deck is ready.",
  },
];

function ReportTypeRow({ reportType }: { reportType: LaunchEnabledReportType }) {
  const copy = WIZARD_REPORT_TYPE_COPY[reportType];
  return (
    <li className="rounded-lg border border-navy-border bg-navy-panel p-4">
      <p className="text-sm font-semibold text-white">{copy.cardHeading}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{copy.cardYouGet}</p>
    </li>
  );
}

function StepRow({ number, step }: { number: number; step: Step }) {
  return (
    <div className="flex gap-4 rounded-lg border border-navy-border bg-navy-panel p-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-orange text-sm font-bold text-navy"
        aria-hidden="true"
      >
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">{step.title}</h3>
        {step.detail ? <p className="mt-0.5 text-xs text-ink-muted">{step.detail}</p> : null}
        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
      </div>
    </div>
  );
}

export default async function HowItWorksPage() {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "How It Works", path: "/how-it-works" },
            ]),
            faqPageJsonLd(PRODUCT_FAQ_SCHEMA),
            howToJsonLd(
              "How to generate a client report with NextReport",
              "Generate a branded Meta Ads client report in under 2 minutes via day-wise CSV from Meta Ads Reporting.",
              HOW_IT_WORKS_STEPS_SCHEMA,
            ),
          ],
        }}
      />
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="bg-navy px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">How NextReport Works</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Client setup once, then a branded Meta deck in under 2 minutes — pick a report type and upload a
              day-wise CSV.
            </p>
            <p className="mt-3 text-sm text-ink-secondary">
              Live today: Meta Ads reporting. Google Ads, TikTok Ads, and GA4 are launching soon.
            </p>
          </div>
        </section>

        <section className="border-b border-navy-border bg-navy-panel px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold text-white">Watch the wizard flow</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-secondary">
              This animated walkthrough mirrors the report wizard. Each step auto-advances — click the dots to jump
              ahead.
            </p>
            <div className="mt-10">
              <ProductExplainerAnimation />
            </div>
            <p className="mx-auto mt-6 max-w-xl text-center text-xs text-ink-muted">
              Prefer a live walkthrough with your own accounts?{" "}
              <Link href="/book-demo" className="text-accent-orange hover:underline">
                Book a demo
              </Link>
              .
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section>
            <h2 className="text-2xl font-semibold text-white">Before your first report</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              Three one-time setup steps — then every report reuses the same client and branding.
            </p>
            <ol className="mt-6 space-y-4">
              {SETUP_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4 rounded-lg border border-navy-border bg-navy-panel p-5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-accent-orange">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            {loggedIn ? (
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <Link href="/clients/new" className="text-accent-orange hover:underline">
                  Add a client →
                </Link>
                <Link href="/account" className="text-accent-orange hover:underline">
                  Account Settings →
                </Link>
              </div>
            ) : (
              <p className="mt-4 text-sm">
                <Link href="/signup" className="text-accent-orange hover:underline">
                  Start free trial →
                </Link>
              </p>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">How you get data in (Meta)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              On Import, choose your report type — each type needs a specific date range with{" "}
              <strong className="font-medium text-ink-muted">day-wise</strong> breakdown from{" "}
              <strong className="font-medium text-ink-muted">Meta Ads Reporting</strong> (not the Campaigns screen
              export). Hover a report-type card in the wizard for the exact CSV range. Automatic Meta API sync in the
              wizard is off for now; CSV is the supported path.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              Export walkthrough:{" "}
              <Link href="/help/download" className="text-accent-orange hover:underline">
                CSV Export Guide
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Optional: Previous Month CSV (weekly decks)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              For weekly reports, you can attach a second file with the last full calendar month (day-wise). It powers
              the previous-month row on the Monthly Overview slide — not a month-over-month comparison deck.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Report types available</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">
              Six types in the wizard today — names and slide layouts match what you select on Import.
            </p>
            <ul className="mt-6 space-y-3">
              {REPORT_TYPE_ORDER.map((type) => (
                <ReportTypeRow key={type} reportType={type} />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">The 4 wizard steps</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">
              Same order and labels as the app — Import, Campaigns, Metrics, Generate.
            </p>
            <div className="mt-6 space-y-4">
              {WIZARD_STEPS.map((step, i) => (
                <StepRow key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">What you get</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {OUTPUTS.map((output) => (
                <div key={output.title} className="flex gap-4 rounded-lg border border-navy-border bg-navy-panel p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-xl" aria-hidden="true">
                    {output.icon}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{output.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{output.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="bg-navy-panel px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{MARKETING_TRY_CTA_HEADLINE}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ink-secondary">
            Start a free 7-day trial — or book a live demo if you want us to walk through your workflow first.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              {loggedIn ? "Go to Dashboard" : "Start free trial"}
            </Link>
            <Link
              href="/book-demo"
              className="inline-block rounded-md border border-navy-border px-6 py-3 text-sm font-semibold text-white hover:bg-navy"
            >
              Book a demo
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
