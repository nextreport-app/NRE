import { Breadcrumbs } from "@/components/breadcrumbs";
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
  howToJsonLd,
  HOW_IT_WORKS_STEPS_SCHEMA,
  pageMetadata,
} from "@/lib/seo";
import { MARKETING_TRY_CTA_HEADLINE } from "@/lib/product-positioning";
import { META_LAUNCH_HERO_BADGE } from "@/lib/meta-launch-scope";

export const metadata: Metadata = pageMetadata({
  title: "How It Works — Meta Ads Report Wizard",
  description:
    "Connect Meta or upload a CSV for branded reports. Compare account performance, monitor budgets, view GA4 website traffic and schedule drafts for review.",
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

const REPORT_TYPES = [
  { title: "Weekly", body: "A weekly overview with month-to-date totals and a 30-day chart." },
  { title: "Monthly", body: "Performance for your selected calendar month." },
  { title: "Compare", body: "Compare the last 7 days with the previous 7 days, or choose two custom ranges." },
  { title: "Daily", body: "Day-by-day performance across your selected dates." },
  { title: "Breakdown", body: "Campaign performance by age, placement, location or platform, from the matching CSV or Meta API." },
  { title: "Creative · Beta", body: "Creative performance reporting is in Beta while we refine the workflow." },
];

interface Step {
  title: string;
  body: string;
  detail?: string;
}

const WIZARD_STEPS: Step[] = [
  {
    title: "Import",
    body: "Choose your report type, then sync Meta through read-only API access or upload the matching day-wise CSV. The wizard shows the required dates and breakdown columns.",
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
    description: "Editable slides with your branding, objective-based metrics and report summaries.",
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

function ReportTypeRow({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-lg border border-navy-border bg-navy p-4 sm:p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
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
            howToJsonLd(
              "How to generate a Meta Ads client report with NextReport",
              "Generate a branded Meta Ads client report through read-only API sync or a day-wise CSV from Meta Ads Reporting.",
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
            <Breadcrumbs current="How It Works" />
            <p className="inline-block rounded-full border border-navy-border bg-navy-panel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-orange">
              {META_LAUNCH_HERO_BADGE}
            </p>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">How NextReport works</h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-secondary">
              Set up a client, connect Meta or upload a CSV, then review and share a branded report.
              Between reports, check account priorities, budget pacing and GA4 website traffic.
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
            <h2 className="text-2xl font-semibold text-white">Getting data in (Meta API or CSV)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              On <strong className="font-medium text-ink-muted">Import</strong>, choose your report type first. Each type
              shows the required dates and columns. API sync fetches the data; CSV imports need a <strong className="font-medium text-ink-muted">day-wise</strong> breakdown
              from <strong className="font-medium text-ink-muted">Meta Ads Manager</strong>. For breakdown reports,
              export at Campaign level with Day and the matching segment columns. Follow the wizard’s CSV instructions for your report type.
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
              Choose the format that matches your client’s question. Creative reporting remains Beta.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {REPORT_TYPES.map((type) => (
                <ReportTypeRow key={type.title} {...type} />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">The reporting workflow</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">Select campaigns, check the relevant metrics and review before generating. Breakdown and creative flows use fewer steps.</p>
            <div className="mt-6 space-y-3">
              {WIZARD_STEPS.map((step, i) => (
                <StepRow key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-navy-border bg-navy-panel p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white">Between reports: know where to look next</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-secondary">
              <li><strong className="text-white">Meta overview:</strong> connect client accounts, enable monitoring and compare campaign outcomes. See critical changes, issues to review and improvements with freshness and data coverage shown.</li>
              <li><strong className="text-white">Budget pacing:</strong> enter the approved monthly ad spend, excluding tax. Check projected over- or underspend and opt in to owner warning emails. Make campaign changes in Ads Manager.</li>
              <li><strong className="text-white">Website overview:</strong> connect GA4, link each client’s property and manually refresh 7- or 30-day website comparisons. Meta attribution and website channel metrics stay separate.</li>
              <li><strong className="text-white">Scheduled drafts:</strong> choose a daily, weekly, fortnightly or monthly Meta schedule and recipients. Review the private draft in Reports, approve the content, then explicitly send it.</li>
              <li><strong className="text-white">Agency designs · Beta:</strong> restyle a compatible starter, upload it, review a sample and approve it before assigning it to a client. Existing decks may need adaptation.</li>
            </ul>
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
