import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Getting Started",
  description:
    "Learn how NextReport works — connect Meta or Google Ads via API, upload a CSV, generate PowerPoint reports, and share a live browser link or PDF with clients.",
  path: "/how-it-works",
});

interface ReportType {
  name: string;
  description: string;
}

const REPORT_TYPES: ReportType[] = [
  { name: "Weekly Performance Report", description: "Last 7 days vs month to date." },
  { name: "Monthly Performance Report", description: "Full month summary." },
  { name: "Bi-weekly Report", description: "Custom 14-day period." },
  {
    name: "Comparison Report",
    description: "Compare any two periods side by side. This week vs last week. This month vs last month. Any custom date range you choose.",
  },
  { name: "Custom Date Range", description: "Any period you choose." },
];

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Connect or upload",
    body: "Choose Sync from API (Meta Marketing API or Google Ads API) or upload a Last 30 Days CSV. Meta users can also add an optional Previous Month CSV for the overview row.",
  },
  {
    title: "Select campaigns",
    body: "Choose which campaigns to include in your report, and select or deselect ad sets.",
  },
  {
    title: "Confirm objectives",
    body: "Review what each campaign was optimising for — leads, purchases, traffic, reach and more. The engine detects this automatically; you just confirm or correct it.",
  },
  {
    title: "Review metric cards",
    body: "See which metrics will appear on each campaign slide, and add or remove them as needed.",
  },
  {
    title: "Choose period and generate",
    body: "Select your report type and date range, then click Generate.",
  },
];

const OUTPUTS = [
  {
    icon: "📥",
    title: "Download as PowerPoint (.pptx)",
    description: "The same format your clients already expect.",
  },
  {
    icon: "🌐",
    title: "View in browser",
    description: "Share a link your clients open on any device — no PowerPoint needed.",
  },
  {
    icon: "☁️",
    title: "Save to Google Drive",
    description: "Automatic upload to your Drive with a shareable folder link.",
  },
  {
    icon: "💬",
    title: "Share via WhatsApp or Email",
    description: "One click from the download screen.",
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
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="bg-navy px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">How NextReport Works</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Official API sync or CSV upload — client-ready reports in under 2 minutes
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section>
            <h2 className="text-2xl font-semibold text-white">How you get data in</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              NextReport syncs with Meta&apos;s Marketing API and Google&apos;s Ads API. Connect in Account
              Settings and choose <span className="text-white">Sync from API</span> in the wizard — no CSV needed.
              Prefer a manual export? CSV upload works the same way it always has.
            </p>
            {loggedIn ? (
              <p className="mt-3 text-sm">
                <Link href="/account" className="text-accent-orange hover:underline">
                  Connect your ad accounts in Account Settings →
                </Link>
              </p>
            ) : null}
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
            <h2 className="text-2xl font-semibold text-white">The 5 steps</h2>
            <div className="mt-6 space-y-4">
              {STEPS.map((step, i) => (
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
          <div className="mt-6">
            <Link
              href={loggedIn ? "/clients" : "/signup"}
              className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
            >
              {loggedIn ? "Go to Dashboard" : "Start free trial"}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
