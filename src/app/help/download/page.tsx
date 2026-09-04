import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { isMetaApiConfigured, isGoogleAdsApiConfigured } from "@/lib/integrations-config";

export const metadata: Metadata = {
  title: "Download Guide — NextReport",
  description: "Connect via official Meta and Google Ads APIs, or export CSVs manually.",
};

interface Step {
  title: string;
  body: string;
}

const META_LAST_30_STEPS: Step[] = [
  { title: "Open Meta Ads Manager → Campaigns", body: "" },
  { title: "Reports → Export → Export Table Data", body: "" },
  { title: "Date range: Last 30 Days", body: "Use this every day except the 1st of the month (see callout below)." },
  {
    title: "Time Breakdown: Day",
    body: "Required — one row per day. Weekly slides, month-to-date, and the visual chart all read from this file.",
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
  const metaApiLive = isMetaApiConfigured();
  const googleApiLive = isGoogleAdsApiConfigured();

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={loggedIn} />
      <main className="flex-1">
        <section className="bg-navy px-6 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Data guide</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Connect via official APIs — or export CSVs manually if you prefer
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          {/* API path — preferred */}
          <section>
            <SectionHeading>Option A — Sync from API (recommended)</SectionHeading>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-secondary">
              NextReport syncs with{" "}
              <span className="text-white">Meta&apos;s Marketing API</span> and{" "}
              <span className="text-white">Google&apos;s Ads API</span>. Connect once in Account Settings and pull
              campaign data directly — no CSV export from Ads Manager.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-[#63b3ed]/30 bg-navy-panel p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#63b3ed]">Meta Marketing API</p>
                <h3 className="mt-2 text-base font-semibold text-white">Connect Meta Ads</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Account Settings → Meta Ads → Connect. Read-only access — we never change your campaigns.
                </p>
                <p className="mt-3 text-xs text-ink-muted">
                  {metaApiLive ? "Available on this site." : "Your admin must add META_APP_ID and META_APP_SECRET on Vercel."}
                </p>
                {loggedIn ? (
                  <Link href="/account#meta-ads" className="mt-4 inline-block text-sm font-semibold text-accent-orange hover:underline">
                    Open Account Settings →
                  </Link>
                ) : null}
              </div>
              <div className="rounded-lg border border-[#68d391]/30 bg-navy-panel p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#68d391]">Google Ads API</p>
                <h3 className="mt-2 text-base font-semibold text-white">Connect Google Ads</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  Same pattern as Meta — OAuth in Account Settings, then pick account and dates in the report wizard.
                </p>
                <p className="mt-3 text-xs text-ink-muted">
                  {googleApiLive ? "Available on this site." : "Google Ads API env vars are being rolled out — CSV upload works today."}
                </p>
                {loggedIn ? (
                  <Link href="/account#google-ads" className="mt-4 inline-block text-sm font-semibold text-accent-orange hover:underline">
                    Open Account Settings →
                  </Link>
                ) : null}
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              In the report wizard, choose <span className="text-white">Sync from API</span> on Step 1 after connecting.
              API-powered generation is rolling out — CSV upload below always works.
            </p>
          </section>

          {/* CSV path */}
          <section>
            <SectionHeading>Option B — Upload CSV manually</SectionHeading>
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

          <section>
            <SectionHeading>Google Ads — CSV export</SectionHeading>
            <p className="mt-4 text-sm text-ink-secondary">
              Google reports currently use CSV upload. API sync uses the same metrics once your Google Ads account is
              connected.
            </p>
            <div className="mt-6 space-y-4">
              {GOOGLE_STEPS.map((step, i) => (
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
              How It Works
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
