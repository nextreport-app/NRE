import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { DEFAULT_KEYWORDS, pageMetadata } from "@/lib/seo";
import {
  META_CSV_EXPORT_PATH,
  META_CSV_HELP_BASE,
  META_CSV_HELP_BY_OBJECTIVE,
  META_CSV_HELP_PREVIOUS_MONTH,
} from "@/lib/nre/meta-csv-export-guide";

export const metadata: Metadata = pageMetadata({
  title: "CSV Export Guide",
  description:
    "Quick Meta, Google, and TikTok CSV export steps for NextReport — Ad Reporting export with Day-wise breakdown and recommended columns.",
  path: "/help/download",
  keywords: [
    "meta ads csv export",
    "google ads csv export",
    "csv to ppt",
    "meta reporting csv columns",
    ...DEFAULT_KEYWORDS,
  ],
});

function VerticalMetricList({ metrics }: { metrics: readonly string[] }) {
  return (
    <ul className="mt-2 space-y-1.5 border-l-2 border-navy-border pl-4 text-[15px] leading-relaxed text-ink-secondary">
      {metrics.map((metric) => (
        <li key={metric}>{metric}</li>
      ))}
    </ul>
  );
}

function HelpBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-navy-border bg-navy/30 px-4 py-4">
      <h3 className="text-[16px] font-semibold text-white">{title}</h3>
      <div className="mt-2">{children}</div>
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
        <section className="bg-navy px-6 py-12 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">CSV export — quick guide</h1>
            <p className="mt-3 text-base text-ink-muted">Export once in Ads Manager, upload on Import.</p>
          </div>
        </section>

        <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
          <section id="meta-ads" className="space-y-6 rounded-lg border border-navy-border bg-navy-panel p-6">
            <h2 className="text-xl font-semibold text-accent-orange">Meta Ads</h2>

            <div className="space-y-4 rounded-lg border border-amber-500/35 bg-amber-950/20 p-5">
              <p className="text-[16px] font-semibold text-amber-100">{META_CSV_EXPORT_PATH.title}</p>

              <div>
                <p className="text-[14px] font-medium text-amber-100/90">Steps</p>
                <VerticalMetricList metrics={META_CSV_EXPORT_PATH.exportSteps} />
              </div>

              <p className="text-[15px] leading-relaxed text-amber-100/90">{META_CSV_EXPORT_PATH.dayBreakdownImportant}</p>

              <div>
                <p className="text-[15px] font-medium text-ink-secondary">{META_CSV_EXPORT_PATH.baseColumnsIntro}</p>
                <VerticalMetricList metrics={META_CSV_EXPORT_PATH.baseColumnsInExport} />
                <p className="mt-2 text-[15px] text-ink-secondary">{META_CSV_EXPORT_PATH.baseColumnsOutro}</p>
              </div>

              <p className="text-[15px] leading-relaxed text-ink-secondary">{META_CSV_EXPORT_PATH.saveTip}</p>
            </div>

            <div id="meta-metrics" className="space-y-4">
              <HelpBlock title={META_CSV_HELP_BASE.title}>
                <p className="text-[14px] text-ink-muted">{META_CSV_HELP_BASE.subtitle}</p>
                <VerticalMetricList metrics={META_CSV_HELP_BASE.metrics} />
              </HelpBlock>

              <HelpBlock title={META_CSV_HELP_BY_OBJECTIVE.title}>
                <VerticalMetricList metrics={META_CSV_HELP_BY_OBJECTIVE.metrics} />
              </HelpBlock>
            </div>

            <HelpBlock title={META_CSV_HELP_PREVIOUS_MONTH.title}>
              <p className="text-[15px] leading-relaxed text-ink-secondary">{META_CSV_HELP_PREVIOUS_MONTH.body}</p>
            </HelpBlock>
          </section>

          <section id="google-ads" className="rounded-lg border border-navy-border bg-navy-panel p-6">
            <h2 className="text-xl font-semibold text-accent-orange">Google Ads</h2>
            <ol className="mt-4 list-inside list-decimal space-y-1 text-[15px] text-ink-secondary">
              <li>Reports → Predefined → Basic → Campaign</li>
              <li>Segment → Day · Last 30 days</li>
              <li>Columns: Campaign, Day, Cost, Impressions, Clicks, CTR, Avg. CPC, Conversions, Cost per conversion</li>
              <li>Download CSV → upload on Import</li>
            </ol>
          </section>

          <section id="tiktok-ads" className="rounded-lg border border-navy-border bg-navy-panel p-6">
            <h2 className="text-xl font-semibold text-accent-orange">TikTok Ads</h2>
            <ol className="mt-4 list-inside list-decimal space-y-1 text-[15px] text-ink-secondary">
              <li>Campaign or Ad group report · Last 30 days · Breakdown: Day</li>
              <li>Columns: Campaign name, Ad group name, Day, Cost, Impressions, Clicks, CTR, CPC, Conversions</li>
              <li>Download CSV → same wizard as Meta</li>
            </ol>
          </section>

          <p className="text-center text-sm text-ink-muted">
            GA4 website reports: connect in Account Settings, then choose Google Analytics in the wizard.
          </p>
        </div>

        <section className="bg-navy-panel px-6 py-12 text-center">
          <Link
            href={loggedIn ? "/clients" : "/signup"}
            className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
          >
            {loggedIn ? "Go to Dashboard" : "Start free trial"}
          </Link>
        </section>
      </main>
    </>
  );
}
