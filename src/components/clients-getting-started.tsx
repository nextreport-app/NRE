"use client";
import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";
export function ClientsGettingStarted({ emailVerified = true }: { emailVerified?: boolean }) {
  const { dashboard: d } = useSiteCopy();
  return <section className="rounded-xl border border-dash-border bg-dash-card px-6 py-7 sm:px-8">
    <h2 className="text-[22px] font-bold text-dash-ink">Create your first report</h2>
    <p className="mt-2 max-w-lg text-sm leading-relaxed text-dash-ink-secondary">Add a client, then sync Meta Ads or upload a CSV to create their report.</p>
    <Link href={emailVerified ? "/clients/new" : "#verify-email"} className="mt-5 inline-flex rounded-lg bg-dash-accent px-5 py-3 text-sm font-semibold text-[#0d1b2e] hover:bg-dash-accent-hover">{emailVerified ? d.emptyAddClientCta : "Verify email to get started"} →</Link>
  </section>;
}
