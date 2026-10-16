"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** One of the 8 metric cards in the hero's slide mockup — amber uppercase label, bold white value, matching the real PPTX campaign slide's own card style. */
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1e3a5f] bg-[#111f35] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#f5b45a]">{label}</p>
      <p className="mt-1 text-base font-bold text-white sm:text-lg">{value}</p>
    </div>
  );
}

function SlideMockup({
  campaign,
  weekly,
  metrics,
}: {
  campaign: string;
  weekly: string;
  metrics: { label: string; value: string }[];
}) {
  return (
    <div className="nre-keep-dark-surface w-full max-w-sm rounded-xl border border-[#1e3a5f] bg-[#0d1b2e] p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] sm:max-w-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{campaign}</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
          {weekly}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
    </div>
  );
}

export function HeroSection({ loggedIn }: { loggedIn: boolean }) {
  const { marketing, home } = useSiteCopy();

  return (
    <section className="nre-hero-section bg-navy px-6 py-20 sm:py-28">
      <div
        className="nre-marketing-hero-glow pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="max-w-xl text-center lg:text-left">
          <span className="inline-block rounded-full border border-navy-border bg-navy-panel px-3 py-1 text-xs font-medium tracking-wide text-ink-secondary">
            {marketing.heroBadge}
          </span>

          <h1 className="mt-5 text-[2.25rem] font-bold leading-tight tracking-tight text-ink sm:text-[3rem]">
            {marketing.heroHeadlineAccent && marketing.heroHeadlineBefore !== undefined ? (
              <>
                {marketing.heroHeadlineBefore}
                <span className="text-accent-orange">{marketing.heroHeadlineAccent}</span>
                {marketing.heroHeadlineAfter}
              </>
            ) : (
              marketing.heroHeadline
            )}
          </h1>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-secondary sm:text-lg">
            {marketing.heroSubtext}
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
            {loggedIn ? (
              <Link
                href="/clients"
                className="nre-hero-cta-primary inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                {marketing.heroGoDashboard}
              </Link>
            ) : (
              <Link
                href="/signup"
                className="nre-hero-cta-primary inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold sm:w-auto"
              >
                {marketing.heroStartTrial}
              </Link>
            )}
            <Link
              href="/book-demo"
              className="nre-hero-cta-secondary inline-flex w-full items-center justify-center gap-1 rounded-full px-6 py-3 text-sm font-medium sm:w-auto"
            >
              {marketing.heroRequestDemo} <span aria-hidden="true">→</span>
            </Link>
          </div>

          {!loggedIn && <p className="mt-4 text-xs text-ink-muted">{marketing.heroNoCard}</p>}
        </div>

        <div className="flex w-full justify-center lg:w-auto">
          <SlideMockup
            campaign={home.heroMockCampaign}
            weekly={home.heroMockWeekly}
            metrics={home.heroMetrics}
          />
        </div>
      </div>
    </section>
  );
}
