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
import { PLATFORM_LIST_API, PLATFORM_LIST_SHORT } from "@/lib/plan-labels";

export const metadata: Metadata = pageMetadata({
  title: "How It Works — 5-Step Report Wizard",
  description:
    "Set up a client, connect Meta, Google, TikTok, or GA4 via API or CSV, then generate a branded .pptx, live link, or PDF in under 2 minutes.",
  path: "/how-it-works",
});

interface ReportType {
  name: string;
  description: string;
}

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
    title: "Connect ad accounts (optional)",
    body: "In Account Settings, connect Meta, Google Ads, TikTok, or GA4 once. After that, choose Sync from API in the wizard instead of uploading CSVs.",
  },
];

const REPORT_TYPES: ReportType[] = [
  { name: "Weekly Performance Report", description: "Last 7 days vs month to date — the default for agency weekly check-ins." },
  { name: "Monthly Performance Report", description: "Full calendar month summary with MTD context where applicable." },
  { name: "Bi-weekly Report", description: "Custom 14-day reporting window." },
  {
    name: "Comparison Report",
    description: "Compare any two periods side by side — this week vs last week, this month vs last month, or any custom range.",
  },
  { name: "Custom Date Range", description: "Any start and end date you choose." },
];

interface Step {
  title: string;
  body: string;
  detail?: string;
}

const WIZARD_STEPS: Step[] = [
  {
    title: "Add your ad data",
    body: "Open New Report on a client. Pick Meta, Google Ads, TikTok, or GA4, then choose Sync from API or upload a CSV export. Meta users can also attach an optional Previous Month CSV for the overview row.",
    detail: "Step label in the app: Upload",
  },
  {
    title: "Select campaigns and ad sets",
    body: "Check the campaigns that belong in this deck. Unchecked campaigns stay out entirely. Ad-set slides are optional — campaign totals still include their spend.",
    detail: "Step label in the app: Campaigns",
  },
  {
    title: "Confirm objectives",
    body: "NextReport detects whether each campaign optimised for leads, purchases, traffic, reach, or other goals. Confirm or correct anything flagged — wrong objectives mean wrong metric cards.",
    detail: "Step label in the app: Objectives",
  },
  {
    title: "Review metric cards",
    body: "See the KPI chips that will appear on each campaign slide. Remove metrics you do not need or add extras from the CSV columns available.",
    detail: "Step label in the app: Metrics",
  },
  {
    title: "Choose report type and generate",
    body: "Pick weekly, monthly, comparison, or custom dates. Review the summary, then generate. Download .pptx, share a live browser link, export PDF, email, WhatsApp, or save to Google Drive.",
    detail: "Step label in the app: Generate",
  },
];

const OUTPUTS = [
  {
    icon: "📥",
    title: "Download as PowerPoint (.pptx)",
    description: "The same format your clients already expect — with your agency branding and AI-written insights.",
  },
  {
    icon: "🔗",
    title: "Share a live browser link",
    description: "Clients open the report on any device. No PowerPoint install required.",
  },
  {
    icon: "📄",
    title: "Export PDF",
    description: "Print-ready PDF from the same report data — ideal for email attachments.",
  },
  {
    icon: "☁️",
    title: "Save to Google Drive",
    description: "Automatic upload to your Drive with a shareable folder link.",
  },
  {
    icon: "💬",
    title: "Share via WhatsApp or Email",
    description: "One click from the download screen after generation.",
  },
];

function FileCard({ label, cadence, title, body }: { label: string; cadence: string; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-navy-border border-l-4 border-l-accent-orange bg-navy-panel p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-orange">
        {label} <span className="text-ink-muted">— {cadence}</span>
      </p>
      <h3 className="mt-1 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{body}</p>
    </div>
  );
}

function ReportTypeRow({ type }: { type: ReportType }) {
  return (
    <li className="rounded-lg border border-navy-border bg-navy-panel p-4">
      <p className="text-sm font-semibold text-white">{type.name}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{type.description}</p>
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
              "Generate a branded Meta, Google, TikTok, or GA4 client report in under 2 minutes via API sync or CSV upload.",
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
              From client setup to a branded client deck in under 2 minutes — API sync or CSV upload
            </p>
            <p className="mt-3 text-sm text-ink-secondary">
              Supports {PLATFORM_LIST_SHORT}
            </p>
          </div>
        </section>

        <section className="border-b border-navy-border bg-navy-panel px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-semibold text-white">Watch the 5-step flow</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-secondary">
              This animated walkthrough mirrors the actual report wizard in the app. Each step auto-advances — click the
              dots to jump ahead.
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
              Three one-time setup steps — then every report reuses the same client and connections.
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
            <h2 className="text-2xl font-semibold text-white">How you get data in</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              NextReport syncs with {PLATFORM_LIST_API}. Connect once in Account Settings, then choose{" "}
              <span className="text-white">Sync from API</span> in step 1 of the wizard — no CSV needed. Prefer a manual
              export? CSV upload follows the same 5-step wizard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">TikTok Ads</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              Connect TikTok Ads in Account Settings, then choose API sync or upload a TikTok CSV export. Campaign spend,
              results, and KPIs land in the same branded deck as your Meta and Google reports. TikTok appears in the
              wizard for supported regions; availability may vary by location.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Website Traffic (GA4)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              From any client page, open <span className="text-white">Website Traffic Report</span> to generate a GA4
              deck — sessions, channels, landing pages, device and geo breakdowns, and more. Connect GA4 in Account
              Settings, link a property to the client, then choose API sync or upload a GA4 CSV export.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">If you use CSV (Meta)</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              Two optional uploads power the full weekly Meta workflow:
            </p>
            <div className="mt-6 space-y-4">
              <FileCard
                label="File 1"
                cadence="upload once per month"
                title="Previous Month CSV"
                body="Last full calendar month from Meta. Adds the previous month row on the Monthly Overview slide — so clients see how campaigns performed last month alongside this month's MTD. Not a month-over-month comparison."
              />
              <FileCard
                label="File 2"
                cadence="upload every week"
                title="Last 30 Days, Day by Day"
                body="Powers weekly slides, MTD row, visual chart (last 30 days), and comparison reports. On the 1st, export Previous Month with Day breakdown instead — see the CSV Export Guide."
              />
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              Step-by-step export instructions:{" "}
              <Link href="/help/download" className="text-accent-orange hover:underline">
                CSV Export Guide
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Report types available</h2>
            <ul className="mt-6 space-y-3">
              {REPORT_TYPES.map((type) => (
                <ReportTypeRow key={type.name} type={type} />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">The 5 wizard steps</h2>
            <p className="mt-3 max-w-3xl text-sm text-ink-secondary">
              These match the report wizard exactly — same order, same labels you see in the app.
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
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to try it yourself?</h2>
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
