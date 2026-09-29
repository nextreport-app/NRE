import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { DEFAULT_KEYWORDS, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "CSV & API Export Guide",
  description:
    "How to export Meta Ads, Google Ads, TikTok, and GA4 data for NextReport — required CSV columns and date ranges.",
  path: "/help/download",
  keywords: [
    "meta ads csv export",
    "google ads csv export",
    "csv to ppt",
    "csv to pdf",
    "meta reporting csv columns",
    ...DEFAULT_KEYWORDS,
  ],
});

interface Step {
  title: string;
  body: string;
}

const META_LAST_30_STEPS: Step[] = [
  { title: "Open Meta Ads Manager → Campaigns", body: "" },
  { title: "Reports → Export → Export Table Data", body: "" },
  {
    title: "Date range: Last 30 Days",
    body: "On the 1st of the month, use Previous Month instead — see the callout below.",
  },
  {
    title: "Time Breakdown: Day",
    body: "Required — one row per day.",
  },
  {
    title: "Columns to include",
    body: "Campaign name, Day, Result type, Results, Amount spent, Cost per result, Reach, Impressions, CTR (all), CPC (link click), Frequency, Link clicks, Landing page views, Cost per landing page view.",
  },
  {
    title: "Lead gen campaigns — also include",
    body: "Website leads, On-Facebook leads, Cost per lead.",
  },
  { title: "Export as CSV", body: "" },
];

const META_PREVIOUS_MONTH_STEPS: Step[] = [
  { title: "Same export flow — set date range to Last Month", body: "" },
  {
    title: "Time Breakdown",
    body: "Day is recommended. Monthly totals (no day breakdown) also work for the previous month row.",
  },
  { title: "Same columns as the Last 30 Days export", body: "" },
  { title: "Export as CSV", body: "Upload once per client in the wizard or on the client page." },
];

const META_AD_LEVEL_STEPS: Step[] = [
  { title: "Meta Ads Manager → Ads tab", body: "Not Campaigns or Ad Sets." },
  { title: "Last 30 days (or at least 14 days)", body: "" },
  { title: "Time Breakdown: Day", body: "" },
  {
    title: "Columns",
    body: "Campaign name, Ad set name, Ad name, Day, Amount spent, Results, Cost per result, Reach, Impressions, CTR, Frequency, Link clicks.",
  },
  { title: "Video ads — also include", body: "3-second video plays, ThruPlays." },
  { title: "Export as CSV", body: "Powers Creative reports and optional creative slides in any report." },
];

const TIKTOK_STEPS: Step[] = [
  { title: "TikTok Ads Manager → Campaign / Ad group report", body: "" },
  { title: "Date range: Last 30 days", body: "" },
  { title: "Breakdown: Day", body: "Required — one row per day." },
  {
    title: "Columns",
    body: "Campaign name, Ad group name, Day, Cost, Impressions, Clicks, CTR, CPC, Conversions, Cost per conversion.",
  },
  { title: "Download CSV", body: "Same 5-step wizard as Meta — ad groups appear as ad-set slides." },
];

const GOOGLE_STEPS: Step[] = [
  { title: "Google Ads → Reports → Predefined → Basic → Campaign", body: "" },
  { title: "Segment → Day", body: "" },
  { title: "Date range: Last 30 days", body: "" },
  {
    title: "Columns",
    body: "Campaign, Day, Cost, Impressions, Clicks, CTR, Avg. CPC, Conversions, Cost per conversion, Conv. rate, Conv. value.",
  },
  { title: "Download CSV", body: "" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-semibold text-accent-orange">{children}</h2>;
}

function StepCard({ number, step }: { number: number; step: Step }) {
  return (
    <div className="flex gap-4 rounded-lg border border-navy-border border-l-4 border-l-accent-orange bg-navy-panel p-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-accent-orange"
        aria-hidden="true"
      >
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">{step.title}</h3>
        {step.body && <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{step.body}</p>}
      </div>
    </div>
  );
}

export default async function DownloadGuidePage() {
  const session = await auth();
  const loggedIn = !!session?.user;
  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="bg-navy px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Data guide</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Export CSVs from Ads Manager — upload in the report wizard
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section>
            <SectionHeading>Ad reports — CSV upload</SectionHeading>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              Meta, Google, and TikTok ad reports use a CSV export from each platform&apos;s ads manager. Upload the file
              on Step 1 of the report wizard. Automatic API import for those platforms is turned off.
            </p>
            <p className="mt-4 text-sm text-ink-muted">
              GA4 website reports can still use API or CSV from Step 1 when you choose{" "}
              <span className="text-white">Google Analytics</span> — connect in Account Settings and link a property to
              each client first.
            </p>

            <div className="mt-8 rounded-lg border border-[#63b3ed]/40 border-l-4 border-l-[#63b3ed] bg-navy-panel p-5">
              <h3 className="text-lg font-semibold text-white">Previous month CSV</h3>
              <ul className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-secondary">
                <li>
                  <span className="font-semibold text-white">Main report file:</span> Use{" "}
                  <span className="text-white">last 30 complete days ending yesterday</span> with a daily breakdown for
                  weekly slides, MTD, and charts.
                </li>
                <li>
                  <span className="font-semibold text-white">Previous calendar month:</span> Upload a separate CSV for
                  the prior month when you want a previous-month comparison row on Combined Total (see the wizard panel on
                  Step 1).
                </li>
                <li>
                  <span className="font-semibold text-white">Previous-month campaign selection:</span> After upload, the
                  wizard shows a checkbox list of campaigns detected in last month&apos;s data. Uncheck any campaigns you
                  don&apos;t manage — only checked campaigns appear in the Combined Total previous-month row. Your
                  selection is saved per client.
                </li>
                <li>
                  <span className="font-semibold text-white">Report types supported:</span> Weekly, Monthly, Daily,
                  Quarterly, YTD, Comparison, Multi-month Historical, and Demo reports all work from CSV.{" "}
                  <span className="text-white">Creative reports</span> require an Ad-level CSV export.
                </li>
                <li>
                  <span className="font-semibold text-white">Metrics in the wizard:</span> Use the column set in our
                  download guides below. After upload, objectives are detected per campaign, then Step 3 (Metrics)
                  pre-selects chips per objective. CPM and cost per 1K reach are computed from spend/impressions/reach
                  when needed.
                </li>
                <li>
                  <span className="font-semibold text-white">Mixed objectives:</span> An account with Reach, Instant
                  Form, and Landing Page View campaigns gets the correct default chips{" "}
                  <span className="text-white">per campaign</span>, not one global set.
                </li>
                <li>
                  <span className="font-semibold text-white">Extra columns:</span> Video metrics (ThruPlays, 3-second
                  views), purchase conversion value, CPC (all), or any column not in our standard guide — add them in
                  Ads Manager before export when your report needs them.
                </li>
              </ul>
            </div>
          </section>

          {/* CSV path */}
          <section id="meta-ads">
            <SectionHeading>Meta Ads — CSV upload</SectionHeading>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              Two files power a full Meta weekly report: your <span className="text-white">main Last 30 Days CSV</span>{" "}
              (every report) and an optional <span className="text-white">Previous Month CSV</span> (once per month) for
              the previous-month row on the Monthly Overview slide — not a month-over-month comparison, just last
              month&apos;s totals alongside this month&apos;s MTD.
            </p>

            <h3 className="mt-10 text-lg font-semibold text-white">Main CSV — Last 30 Days (Meta)</h3>
            <div className="mt-4 space-y-4">
              {META_LAST_30_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-[#f6ad55]/40 border-l-4 border-l-[#f6ad55] bg-navy-panel p-5">
              <h3 className="text-lg font-semibold text-white">Which date range on the 1st?</h3>
              <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-secondary">
                <li>
                  <span className="font-semibold text-[#f6ad55]">1st of the month</span> (client timezone): export{" "}
                  <span className="text-white">Previous Month</span> with Day breakdown for the main CSV — one file for
                  last week&apos;s slides and last month&apos;s row. Do not use Last 30 Days on the 1st (it skips the 1st
                  of the prior month).
                </li>
                <li>
                  <span className="font-semibold text-[#f6ad55]">All other days:</span>{" "}
                  <span className="text-white">Last 30 Days</span> with Day breakdown — weekly slides, custom ranges,
                  MTD table row, and the visual chart (last 30 days ending yesterday) all come from this file.
                </li>
              </ul>
              <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
                MTD in the Combined Total table uses calendar month day 1 through yesterday. Today is never included.
              </p>
            </div>

            <div className="mt-8 rounded-lg border border-[#63b3ed]/40 border-l-4 border-l-[#63b3ed] bg-navy-panel p-5">
              <h3 className="text-lg font-semibold text-white">Multi-Month Historical reports</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
                When a client asks for the last few months (e.g. May through August), choose{" "}
                <span className="text-white">Multi-Month Historical Report</span> in Step 5 — not a Monthly report and
                not four separate uploads. Export <span className="text-white">one daily CSV</span> whose date range
                covers every complete month you need (Custom date range in Ads Manager, Day breakdown).
              </p>
              <ul className="mt-3 list-inside list-disc space-y-2 text-[15px] leading-relaxed text-ink-secondary">
                <li>
                  Each month gets campaign slides with a month header (e.g. &quot;May Performance&quot;), then a{" "}
                  <span className="text-white">month total slide</span>.
                </li>
                <li>
                  The deck ends with a <span className="text-white">comparison table</span> — one row per month.
                </li>
                <li>Campaigns under $10 spend in a month are excluded (same as other report types).</li>
              </ul>
            </div>

            <div className="mt-8 rounded-lg border border-navy-border bg-navy-panel p-5">
              <h3 className="text-lg font-semibold text-white">Monthly vs Multi-Month Historical</h3>
              <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-ink-secondary">
                <li>
                  <span className="text-white">Monthly</span> — one current or recent month deck with an MTD chart and
                  optional previous-month row on the overview slide.
                </li>
                <li>
                  <span className="text-white">Multi-Month Historical</span> — several complete past months in one
                  deck, with per-month totals and a final comparison table.
                </li>
              </ul>
            </div>

            <h3 className="mt-10 text-lg font-semibold text-white">Optional — Previous Month CSV (Meta)</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Upload once per client at the start of each month. Adds the{" "}
              <span className="text-white">previous month row</span> on the Monthly Overview slide (e.g. Aug 1 - 31). If
              the campaign started mid-month, the row shows the actual span (e.g. Aug 22 - 31). Day or monthly-totals
              exports both work.
            </p>
            <div className="mt-4 space-y-4">
              {META_PREVIOUS_MONTH_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
              <span className="font-semibold">Result Type column</span> tells NextReport what each campaign optimised
              for (purchases, leads, link clicks, etc.).
            </div>

            <h3 className="mt-10 text-lg font-semibold text-white">Creative reports — Ad-level CSV (Meta)</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Only for dedicated Creative reports. If your main CSV includes Ad name, creative slides can be added to
              any report type automatically.
            </p>
            <div className="mt-4 space-y-4">
              {META_AD_LEVEL_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section id="google-ads">
            <SectionHeading>Google Ads — CSV export</SectionHeading>
            <p className="mt-4 text-sm text-ink-secondary">
              Google uses a simplified 2-step wizard — every campaign in your CSV is included with month-to-date totals.
              No campaign picker. Upload a CSV with the columns in our Google Ads guide below.
            </p>
            <div className="mt-6 space-y-4">
              {GOOGLE_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section id="tiktok-ads">
            <SectionHeading>TikTok Ads — CSV export</SectionHeading>
            <p className="mt-4 text-sm text-ink-secondary">
              TikTok uses the same 5-step wizard as Meta. Ad groups map to ad-set slides in your deck.
            </p>
            <div className="mt-6 space-y-4">
              {TIKTOK_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>
        </div>

        <section className="bg-navy-panel px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready to generate your first report?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted">
            See the full workflow on the{" "}
            <Link href="/how-it-works" className="text-accent-orange hover:underline">
              Getting Started
            </Link>{" "}
            page.
          </p>
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
