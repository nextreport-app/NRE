import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { DEFAULT_KEYWORDS, pageMetadata } from "@/lib/seo";
import {
  META_CSV_EXPORT_PATH,
  META_CSV_HELP_BASE,
  META_CSV_HELP_BY_OBJECTIVE,
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

function MetricChip({ label, variant }: { label: string; variant: "base" | "objective" }) {
  const styles =
    variant === "base"
      ? "border-accent-orange/35 bg-accent-orange/10 text-ink-secondary"
      : "border-navy-border bg-navy text-ink-secondary";
  return (
    <li
      className={`rounded-md border px-3 py-2 text-[13px] leading-snug ${styles}`}
    >
      {label}
    </li>
  );
}

function MetricPanel({
  title,
  subtitle,
  metrics,
  variant,
  id,
}: {
  title: string;
  subtitle?: string;
  metrics: readonly string[];
  variant: "base" | "objective";
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-xl border p-5 ${
        variant === "base"
          ? "border-accent-orange/25 bg-gradient-to-br from-accent-orange/5 to-transparent"
          : "border-navy-border bg-navy/50"
      }`}
    >
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{subtitle}</p> : null}
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metrics.map((metric) => (
          <MetricChip key={metric} label={metric} variant={variant} />
        ))}
      </ul>
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
          <section id="meta-ads" className="rounded-lg border border-navy-border bg-navy-panel p-6">
            <h2 className="text-xl font-semibold text-accent-orange">Meta Ads</h2>

            <div className="mt-4 rounded-lg border border-amber-500/40 border-l-4 border-l-amber-400 bg-amber-950/25 p-4">
              <p className="font-semibold text-amber-100">{META_CSV_EXPORT_PATH.title}</p>
              <ul className="mt-2 list-inside list-disc space-y-2 text-[15px] text-ink-secondary">
                <li>{META_CSV_EXPORT_PATH.exportSteps}</li>
                <li className="text-amber-100/90">{META_CSV_EXPORT_PATH.dayBreakdownImportant}</li>
                <li>{META_CSV_EXPORT_PATH.baseColumnsNote}</li>
                <li>{META_CSV_EXPORT_PATH.saveTip}</li>
              </ul>
            </div>

            <div id="meta-metrics" className="mt-8 space-y-5">
              <MetricPanel
                id="meta-metrics-base"
                title={META_CSV_HELP_BASE.title}
                subtitle={META_CSV_HELP_BASE.subtitle}
                metrics={META_CSV_HELP_BASE.metrics}
                variant="base"
              />
              <MetricPanel
                title={META_CSV_HELP_BY_OBJECTIVE.title}
                metrics={META_CSV_HELP_BY_OBJECTIVE.metrics}
                variant="objective"
              />
            </div>

            <details className="mt-8 rounded-lg border border-navy-border bg-navy/40 p-4">
              <summary className="cursor-pointer font-medium text-white">1st of month · previous month file · historical</summary>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-ink-secondary">
                <li>
                  <span className="text-white">1st (client timezone):</span> main file = Previous Month + Day breakdown
                  (no MTD yet).
                </li>
                <li>
                  <span className="text-white">Other days:</span> Last 30 Days + Day for weekly, MTD, and charts.
                </li>
                <li>
                  <span className="text-white">Previous month row:</span> optional second CSV — wizard panel on Import.
                </li>
                <li>
                  <span className="text-white">Multi-month historical:</span> one daily CSV spanning every month you
                  need.
                </li>
                <li>
                  <span className="text-white">Creative reports:</span> Ads tab export with Ad name + Day breakdown.
                </li>
              </ul>
            </details>
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
