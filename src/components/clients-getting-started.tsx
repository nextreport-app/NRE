"use client";
import Link from "next/link";
import { MetaWalkthroughVideoCompact } from "./meta-walkthrough-video";
import { useSiteCopy } from "@/hooks/use-site-copy";
export function ClientsGettingStarted({ emailVerified = true }: { emailVerified?: boolean }) {
  const { dashboard: d } = useSiteCopy();
  return <section className="overflow-hidden rounded-2xl border border-dash-border bg-dash-card">
    <div className="nre-onboarding-intro px-6 py-7 sm:px-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dash-accent">Your first client report</p>
      <h2 className="mt-2 text-[22px] font-bold text-dash-ink">{d.gettingStartedTitle}</h2>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-dash-ink-secondary">Add a client, upload their Meta Ads CSV, then review and share the report. No ad-account connection is needed.</p>
      <ol className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-dash-ink-secondary" aria-label="First report journey"><li>1 · Add client</li><li>2 · Upload CSV</li><li>3 · Review &amp; share</li></ol>
      <Link href={emailVerified ? "/clients/new" : "#verify-email"} className="mt-6 inline-flex rounded-lg bg-dash-accent px-5 py-3 text-[14px] font-semibold text-[#0d1b2e] hover:bg-dash-accent-hover">{emailVerified ? d.emptyAddClientCta : "Verify email to get started"} →</Link>
      <p className="mt-3 text-[12px] text-dash-ink-secondary">Branding, Google Drive and additional connections can wait until after your first report.</p>
    </div>
    <details className="group border-t border-dash-border px-6 py-4 sm:px-8"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-dash-ink [&::-webkit-details-marker]:hidden">Need help exporting your CSV?<span aria-hidden className="group-open:rotate-180">▾</span></summary><div className="mt-4 max-w-xl"><MetaWalkthroughVideoCompact id="clients-getting-started-video" /><Link href="/help/download" className="mt-3 inline-block text-[13px] text-dash-accent hover:underline">{d.helpCsvGuide} →</Link></div></details>
  </section>;
}
