import Link from "next/link";
import type { Metadata } from "next";
import { PublicNav } from "@/components/public-nav";
import { BetaBanner } from "@/components/beta-banner";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Case Studies — NextReport",
  description: "How agencies use NextReport to automate Meta and Google Ads client reporting.",
};

const CASE_STUDIES = [
  {
    title: "Freelancer: 30 clients, 3 hours saved every week",
    summary:
      "A solo media buyer managing Meta Ads for e-commerce brands replaced manual PowerPoint work with CSV upload → generate → share link.",
    metrics: [
      { label: "Time per report", before: "~45 min", after: "~5 min" },
      { label: "Reports per week", before: "30", after: "30 (same volume, less stress)" },
      { label: "Client delivery", before: "Email attachment", after: "Share link + optional Slides" },
    ],
    note: "Template case study — replace with your first beta customer's real numbers and quote.",
  },
  {
    title: "Boutique agency: consistent branding across every client",
    summary:
      "A 4-person agency in India standardized cover slides, agency logo, and AI-written insights so every client deck looks like it came from the same team.",
    metrics: [
      { label: "Brand consistency", before: "Analyst-dependent", after: "Template + agency logo on every slide" },
      { label: "Onboarding new analyst", before: "2–3 weeks", after: "Same-day with wizard" },
      { label: "Platforms", before: "Meta only", after: "Meta + Google Ads" },
    ],
    note: "Template case study — add client logo and permission before publishing.",
  },
];

export default async function CaseStudiesPage() {
  const session = await auth();

  return (
    <>
      <BetaBanner />
      <PublicNav loggedIn={!!session?.user} />
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to NextReport
        </Link>
        <h1 className="mt-6 text-3xl font-semibold text-white">Case studies</h1>
        <p className="mt-3 text-sm text-ink-secondary">
          Real agency workflows with NextReport. The examples below are illustrative templates — swap in verified results
          from your beta users.
        </p>

        <div className="mt-10 space-y-10">
          {CASE_STUDIES.map((study) => (
            <article key={study.title} className="rounded-xl border border-navy-border bg-navy-panel p-6">
              <h2 className="text-xl font-semibold text-white">{study.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{study.summary}</p>
              <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                {study.metrics.map((m) => (
                  <div key={m.label} className="rounded-lg border border-navy-border bg-navy px-3 py-3">
                    <dt className="text-xs uppercase tracking-wide text-ink-muted">{m.label}</dt>
                    <dd className="mt-1 text-sm text-white">
                      {m.before} → <span className="text-accent">{m.after}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs italic text-ink-muted">{study.note}</p>
            </article>
          ))}
        </div>

        <p className="mt-12 text-sm text-ink-secondary">
          Want to be featured?{" "}
          <a href="mailto:hello@nextreport.in?subject=Case%20study" className="text-accent hover:underline">
            Email hello@nextreport.in
          </a>
        </p>
      </main>
    </>
  );
}
