"use client";

import Link from "next/link";
import { MetaWalkthroughVideoCompact } from "@/components/meta-walkthrough-video";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** First visit with no clients — short path, no checklist or progress UI. */
export function ClientsGettingStarted() {
  const { dashboard: d } = useSiteCopy();

  const steps = [
    { href: "/clients/new", title: d.gettingStartedStep1Title, body: d.gettingStartedStep1Body },
    { href: "/help/download", title: d.gettingStartedStep2Title, body: d.gettingStartedStep2Body },
    { href: "/how-it-works", title: d.gettingStartedStep3Title, body: d.gettingStartedStep3Body },
  ] as const;

  return (
    <div className="rounded-xl border border-dash-border bg-dash-card">
      <div className="border-b border-dash-border px-6 py-8 sm:px-8">
        <h2 className="text-[20px] font-bold tracking-tight text-dash-ink sm:text-[22px]">{d.gettingStartedTitle}</h2>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-dash-ink-secondary">{d.gettingStartedLead}</p>
        <Link
          href="/clients/new"
          className="mt-6 inline-flex rounded-lg bg-dash-accent px-6 py-2.5 text-[15px] font-semibold text-dash-ink hover:bg-dash-accent-hover"
        >
          {d.emptyAddClientCta}
        </Link>
        <div className="mt-8 max-w-xl">
          <p className="text-[13px] font-semibold text-dash-ink">Video walkthrough</p>
          <p className="mt-1 text-[13px] text-dash-ink-secondary">Meta CSV export through generate and share.</p>
          <div className="mt-3 [&_.text-ink-muted]:text-dash-ink-secondary [&_a.text-accent-orange]:text-dash-accent">
            <MetaWalkthroughVideoCompact id="clients-getting-started-video" />
          </div>
        </div>
      </div>

      <ol className="divide-y divide-dash-border px-4 py-2 sm:px-6">
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="group flex gap-4 rounded-lg px-3 py-4 transition-colors hover:bg-dash-bg/80 sm:px-4"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dash-bg text-[13px] font-bold text-dash-ink"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-[15px] font-semibold text-dash-ink group-hover:underline">{step.title}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-dash-ink-secondary">{step.body}</span>
              </span>
              <span
                className="mt-1 shrink-0 text-dash-ink-secondary opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="border-t border-dash-border px-6 py-5 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-dash-ink-secondary">{d.gettingStartedAlsoTitle}</p>
        <ul className="mt-3 flex flex-col gap-2 text-[14px] sm:flex-row sm:flex-wrap sm:gap-x-6">
          <li>
            <Link href="/account" className="font-medium text-dash-accent hover:text-dash-accent-hover hover:underline">
              {d.gettingStartedAccountLink}
            </Link>
          </li>
          <li>
            <Link href="/how-it-works" className="font-medium text-dash-accent hover:text-dash-accent-hover hover:underline">
              {d.gettingStartedHowItWorksLink}
            </Link>
          </li>
          <li>
            <Link href="/help/download" className="font-medium text-dash-accent hover:text-dash-accent-hover hover:underline">
              {d.helpCsvGuide}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
