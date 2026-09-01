import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";

export const metadata: Metadata = {
  title: "Download Guide — NextReport",
  description: "How to export your campaign data from Meta Ads and Google Ads.",
};

interface Step {
  title: string;
  body: string;
}

const META_LAST_30_DAYS_STEPS: Step[] = [
  { title: "Go to Meta Ads Manager", body: "Open the Campaigns tab." },
  { title: "Click Reports → Export → Export Table Data", body: "" },
  { title: "Set date range to Last 30 Days", body: "" },
  {
    title: "Set Time Breakdown to Day",
    body: "Important — do not use Weekly or Monthly. NextReport needs one row per day.",
  },
  {
    title: "Include these columns",
    body: "Campaign name, Day, Result type, Results, Amount spent, Cost per result, Reach, Impressions, CTR (all), CPC (cost per link click), Frequency, Link clicks, Landing page views, Cost per landing page view.",
  },
  {
    title: "For lead generation campaigns, also include",
    body: "Website leads, On-Facebook leads, Cost per lead.",
  },
  { title: "Export as CSV", body: "" },
];

const META_PREVIOUS_MONTH_STEPS: Step[] = [
  { title: "Same steps but set date range to Last Month", body: "" },
  { title: "Time Breakdown", body: "Can be None (monthly totals) or Day." },
  { title: "Same columns as above", body: "" },
  { title: "Export as CSV", body: "" },
];

const META_AD_LEVEL_STEPS: Step[] = [
  { title: "Open Meta Ads Manager → Ads tab", body: "Not Campaigns or Ad Sets — select the Ads tab specifically." },
  { title: "Set date range to Last 30 days (or at least 14 days)", body: "" },
  { title: "Set Time Breakdown to Day", body: "Required — one row per ad per day." },
  {
    title: "Include these columns",
    body: "Campaign name, Ad set name, Ad name, Day, Amount spent, Results, Cost per result, Reach, Impressions, CTR (all), Frequency, Link clicks.",
  },
  {
    title: "For video ads, also include",
    body: "3-second video plays, ThruPlays.",
  },
  { title: "Export as CSV", body: "Use for Creative Performance Reports, or any report where you want creative slides included automatically." },
];

const GOOGLE_STEPS: Step[] = [
  {
    title: "Go to Google Ads → Reports → Predefined reports → Basic → Campaign",
    body: "",
  },
  { title: "Click Segment → add Day", body: "" },
  { title: "Set date range to Last 30 days", body: "" },
  {
    title: "Include columns",
    body: "Campaign, Day, Cost, Impressions, Clicks, CTR, Avg. CPC, Conversions, Cost per conversion, Conv. rate, Conv. value.",
  },
  { title: "Download as CSV", body: "" },
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
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Download Guide</h1>
            <p className="mt-4 text-lg text-ink-muted">
              How to export your campaign data from Meta Ads and Google Ads
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section>
            <SectionHeading>How to download from Meta Ads Manager</SectionHeading>

            <h3 className="mt-8 text-lg font-semibold text-white">For Last 30 Days (weekly reporting CSV)</h3>
            <div className="mt-4 space-y-4">
              {META_LAST_30_DAYS_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-[#f6ad55]/40 border-l-4 border-l-[#f6ad55] bg-navy-panel p-5">
              <h3 className="text-lg font-semibold text-white">Which date range? (especially at the start of a month)</h3>
              <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-secondary">
                <li>
                  <span className="font-semibold text-[#f6ad55]">Day 1 of the month:</span> Download{" "}
                  <span className="text-white">Previous Month</span> for a complete monthly report (e.g. August 1–31).
                  Last 30 Days is OK for weekly reports (last 7 days = Aug 25–31) but often drops the 1st from monthly totals.
                </li>
                <li>
                  <span className="font-semibold text-[#f6ad55]">Days 2–7:</span> Use{" "}
                  <span className="text-white">Last 30 Days</span> (not This Month) so your weekly slide has a full 7 days across the month boundary. Set Time Breakdown to Day.
                </li>
                <li>
                  <span className="font-semibold text-[#f6ad55]">Day 8 onwards:</span> Use{" "}
                  <span className="text-white">This Month</span> with Time Breakdown set to Day for month-to-date from the 1st through yesterday.
                </li>
              </ul>
            </div>

            <h3 className="mt-10 text-lg font-semibold text-white">For Previous Month (monthly comparison CSV)</h3>
            <div className="mt-4 space-y-4">
              {META_PREVIOUS_MONTH_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm text-amber-200">
              <span className="font-semibold">Note:</span> Result Type column is important — it tells NextReport what
              each campaign was optimising for (purchases, leads, link clicks etc.)
            </div>

            <h3 className="mt-10 text-lg font-semibold text-white">For Creative Performance Reports (Ad level CSV)</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Only needed for the dedicated Creative report — standard weekly/monthly reports still use Campaign or Ad Set
              level data above. If your CSV includes Ad name, creative slides are added automatically to any report type.
            </p>
            <div className="mt-4 space-y-4">
              {META_AD_LEVEL_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeading>How to download from Google Ads</SectionHeading>
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
