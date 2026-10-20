import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { JsonLd } from "@/components/json-ld";
import { ProductExplainerAnimation } from "@/components/home/product-explainer-animation";
import { MetaWalkthroughVideo } from "@/components/meta-walkthrough-video";
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
import { META_LAUNCH_HERO_BADGE } from "@/lib/meta-launch-scope";
import type { LaunchEnabledReportType } from "@/lib/meta-launch-scope";

export const metadata: Metadata = pageMetadata({
  title: "How It Works — Meta Ads Report Wizard",
  description:
    "Add a Meta client, upload a day-wise CSV from Ads Manager Reporting, and generate a branded .pptx or live share link — usually under 2 minutes.",
  path: "/how-it-works",
});

const SETUP_STEPS = [
  {
    title: "Create your free trial account",
    body: "Sign up in under a minute — no credit card. You get 7 days to run the full Meta report wizard.",
  },
  {
    title: "Add a client workspace",
    body: "From My Clients, set the client name, currency, timezone, and logo. Every slide uses that branding automatically.",
  },
] as const;

const QUICK_LINKS_LOGGED_IN = [
  { href: "/clients/new", label: "Add a client", hint: "Name, currency, logo" },
  { href: "/help/download", label: "CSV export guide", hint: "Day-wise Meta export" },
  { href: "/account", label: "Account settings", hint: "Agency branding" },
  { href: "/clients", label: "My Clients", hint: "Open a report wizard" },
] as const;

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
    body: "Choose the report type, export the matching day-wise CSV from Meta Ads Reporting, and upload it. Optional Previous Month CSV adds the prior-month row on weekly decks.",
    detail: "Wizard step: Import",
  },
  {
    title: "Campaigns & objectives",
    body: "Select campaigns for this deck and confirm each campaign’s primary result objective (leads, purchases, traffic, reach, and more).",
    detail: "Wizard step: Campaigns",
  },
  {
    title: "Review metrics",
    body: "Preview KPI chips on each campaign slide. Remove metrics you do not need or add extras from columns in your export.",
    detail: "Wizard step: Metrics",
  },
  {
    title: "Generate report",
    body: "Confirm dates and report type, then generate. Download .pptx (PowerPoint or Google Slides), share a live link, save to Google Drive, or send via WhatsApp or email.",
    detail: "Wizard step: Generate",
  },
];

const OUTPUTS = [
  {
    icon: "📥",
    title: "Download as PowerPoint (.pptx)",
    description: "The format clients expect — your branding and AI-written insights on every slide.",
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
] as const;

function ReportTypeRow({ reportType }: { reportType: LaunchEnabledReportType }) {
  const copy = WIZARD_REPORT_TYPE_COPY[reportType];
  return (
    <li className="rounded-lg border border-navy-border bg-navy p-4 sm:p-5">
      <p className="text-sm font-semibold text-white">{copy.cardHeading}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{copy.cardYouGet}</p>
    </li>
  );
}

function StepRow({ number, step }: { number: number; step: Step }) {
  return (
    <div className="flex gap-4 rounded-lg border border-navy-border bg-navy-panel p-5 sm:gap-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-orange text-sm font-bold text-navy"
        aria-hidden="true"
      >
        {number}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-white">{step.title}</h3>
        {step.detail ? <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-ink-muted">{step.detail}</p> : null}
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
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
              "How to generate a Meta Ads client report with NextReport",
              "Generate a branded Meta Ads client report in under 2 minutes via day-wise CSV from Meta Ads Reporting.",
              HOW_IT_WORKS_STEPS_SCHEMA,
            ),
          ],
        }}
      />
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="border-b border-navy-border bg-navy px-6 py-14 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="inline-block rounded-full border border-navy-border bg-navy-panel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-orange">
              {META_LAUNCH_HERO_BADGE}
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">How NextReport works</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-secondary">
              One-time client setup, then a branded Meta deck in under 2 minutes — pick a report type and upload a
              day-wise CSV from Ads Manager Reporting.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={loggedIn ? "/clients/new" : "/signup"}
                className="inline-flex rounded-md bg-accent-orange px-6 py-2.5 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
              >
                {loggedIn ? "Add a client" : "Start free trial"}
              </Link>
              <Link
                href="/help/download"
                className="inline-flex rounded-md border border-navy-border px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-panel"
              >
                CSV export guide
              </Link>
            </div>
          </div>
        </section>

        {loggedIn ? (
          <section className="border-b border-navy-border bg-navy-panel/60 px-6 py-10">
            <div className="mx-auto max-w-4xl">
              <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-muted">Jump to</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {QUICK_LINKS_LOGGED_IN.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex flex-col rounded-lg border border-navy-border bg-navy px-4 py-3 transition-colors hover:border-accent-orange/40 hover:bg-navy-panel"
                    >
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                      <span className="mt-0.5 text-xs text-ink-muted">{item.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="border-b border-navy-border px-6 py-14">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold text-white">Full walkthrough (video)</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Meta Ads Reporting → day-wise CSV export → upload and run the four-step NextReport wizard through generate
                and share.
              </p>
            </div>
            <div className="mx-auto mt-10 max-w-3xl lg:max-w-5xl">
              <MetaWalkthroughVideo showChapters />
            </div>
            <div className="mx-auto mt-14 max-w-2xl text-center">
              <h3 className="text-lg font-semibold text-white">Wizard flow preview</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Quick animated mock — auto-advances; use the dots to jump between steps.
              </p>
            </div>
            <div className="mt-8 rounded-xl border border-navy-border bg-navy-panel p-4 sm:p-6">
              <ProductExplainerAnimation />
            </div>
            <p className="mx-auto mt-6 max-w-xl text-center text-xs text-ink-muted">
              Want a live walkthrough with your accounts?{" "}
              <Link href="/book-demo" className="font-medium text-accent-orange hover:underline">
                Book a demo
              </Link>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
            <div>
              <h2 className="text-2xl font-semibold text-white">Before your first report</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                Two one-time steps — then every report reuses the same client and branding.
              </p>
            </div>
            <ol className="space-y-3">
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
          </section>

          <section className="rounded-xl border border-navy-border bg-navy-panel p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white">Getting data in (Meta CSV)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              On <strong className="font-medium text-ink-muted">Import</strong>, choose your report type first. Each type
              needs a specific date range with <strong className="font-medium text-ink-muted">day-wise</strong> breakdown
              from <strong className="font-medium text-ink-muted">Meta Ads Reporting</strong> — not the Campaigns screen
              export. Hover a report-type card in the wizard for the exact CSV range.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              Step-by-step export:{" "}
              <Link href="/help/download" className="font-medium text-accent-orange hover:underline">
                CSV Export Guide →
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Optional: Previous Month CSV (weekly decks)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              For weekly reports, attach a second file with the last full calendar month (day-wise). It powers the
              previous-month row on the Monthly Overview slide — not a month-over-month comparison deck.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Report types in the wizard</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">
              Six Meta report types — names and slide layouts match what you select on Import.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {REPORT_TYPE_ORDER.map((type) => (
                <ReportTypeRow key={type} reportType={type} />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">The 4 wizard steps</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">Same order and labels as the app.</p>
            <div className="mt-6 space-y-3">
              {WIZARD_STEPS.map((step, i) => (
                <StepRow key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">What you get after Generate</h2>
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

        <section className="border-t border-navy-border bg-navy-panel px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{MARKETING_TRY_CTA_HEADLINE}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-ink-secondary">
            Start a free 7-day trial — or book a demo if you want us to walk through your Meta workflow first.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              {loggedIn ? "Go to My Clients" : "Start free trial"}
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
