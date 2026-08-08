import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";

export const metadata: Metadata = {
  title: "How to Download Your Ad Report Data — NextReport",
};

interface Step {
  icon: string;
  title: string;
  body: string;
}

const META_STEPS: Step[] = [
  {
    icon: "🔑",
    title: "Open Meta Ads Manager",
    body: "Go to business.facebook.com/adsmanager and select your ad account.",
  },
  {
    icon: "📋",
    title: "Go to Campaigns, Ad Sets or Ads tab",
    body: "Click on the Campaigns tab to see all your campaigns. Make sure all campaigns are visible.",
  },
  {
    icon: "📅",
    title: "Set your date range",
    body: "Click the date picker in the top right. Select Last 30 Days — this works correctly every day of the month and ensures your weekly report always has complete 7-day data. Always use Day as the time increment — not Weekly or Monthly.",
  },
  {
    icon: "⚙️",
    title: "Select your columns",
    body: "Click Columns → Customise Columns. Add these columns: Campaign Name, Ad Set Name, Day, Result Type, Results, Cost per Result, Amount Spent, Reach, Impressions, Frequency, Clicks (All), CTR (All), CPC (All), Link Clicks, Cost per Link Click.",
  },
  {
    icon: "⬇️",
    title: "Export the CSV",
    body: "Click the Export button (top right) → Export Table Data → CSV. Save the file to your computer.",
  },
  {
    icon: "⬆️",
    title: "Upload to NextReport",
    body: "Go to your client in NextReport, click Generate Report, upload the CSV file you just downloaded.",
  },
];

const GOOGLE_STEPS: Step[] = [
  {
    icon: "🔑",
    title: "Open Google Ads",
    body: "Go to ads.google.com and select your account.",
  },
  {
    icon: "📋",
    title: "Go to Campaigns",
    body: "Click Campaigns in the left sidebar to see all your campaigns.",
  },
  {
    icon: "📅",
    title: "Set date range",
    body: "Click the date range selector in the top right. Select Last 30 days. Make sure segmentation is set to Day.",
  },
  {
    icon: "⬇️",
    title: "Download the report",
    body: "Click the Download button (arrow icon) → CSV. Google Ads will export all visible columns.",
  },
  {
    icon: "⬆️",
    title: "Upload to NextReport",
    body: "Go to your client in NextReport, click Generate Report, upload the CSV file.",
  },
];

const COMMON_ISSUES = [
  {
    title: "No data rows found",
    body: "Make sure you selected Day as the time increment, not Weekly or Monthly. The CSV must have one row per day.",
  },
  {
    title: "Wrong objective detected",
    body: "Add Result Type and Results columns to your Meta Ads export. These help NextReport identify your campaign goal.",
  },
  {
    title: "Missing metrics",
    body: "If metric cards show dashes, the required column was not included in your export. Re-download with all recommended columns selected.",
  },
];

function SectionHeading({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-accent-orange">
      <span aria-hidden="true">{icon}</span>
      {children}
    </h2>
  );
}

function StepCard({ number, step }: { number: number; step: Step }) {
  return (
    <div className="flex gap-4 rounded-lg border border-navy-border border-l-4 border-l-accent-orange bg-navy-panel p-5">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-xl"
        aria-hidden="true"
      >
        {step.icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-orange">Step {number}</p>
        <h3 className="mt-0.5 text-base font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{step.body}</p>
      </div>
    </div>
  );
}

function IssueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy-panel p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
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
            <Link href={loggedIn ? "/clients" : "/"} className="text-sm text-accent hover:underline">
              ← Back to {loggedIn ? "Dashboard" : "NextReport"}
            </Link>
            <h1 className="mt-6 text-3xl font-bold text-white sm:text-4xl">How to Download Your Ad Report Data</h1>
            <p className="mt-4 text-lg text-ink-muted">
              Follow these steps to export your campaign data from Meta Ads Manager or Google Ads, then upload it
              to NextReport.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-5xl space-y-16 px-6 py-16">
          <section>
            <SectionHeading icon="📘">Meta Ads Manager</SectionHeading>
            <div className="mt-6 space-y-4">
              {META_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeading icon="🔵">Google Ads</SectionHeading>
            <div className="mt-6 space-y-4">
              {GOOGLE_STEPS.map((step, i) => (
                <StepCard key={step.title} number={i + 1} step={step} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white">Common Issues and Fixes</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {COMMON_ISSUES.map((issue) => (
                <IssueCard key={issue.title} title={issue.title} body={issue.body} />
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
