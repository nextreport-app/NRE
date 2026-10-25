"use client";

import Link from "next/link";
import { MetaWalkthroughVideo } from "@/components/meta-walkthrough-video";
import { MetaCsvWorkflowVideo } from "@/components/home/meta-csv-workflow-video";

/** Homepage + marketing — Loom walkthrough without the long chapter list. */
export function MetaWalkthroughPromoSection({
  kicker = "Video walkthrough",
  title = "Meta CSV export → branded report in one flow",
  lead = "Watch the full path: Ads Reporting (day-wise CSV) through the NextReport wizard — generate, preview, and share.",
  showFullGuideLink = true,
}: {
  kicker?: string;
  title?: string;
  lead?: string;
  showFullGuideLink?: boolean;
}) {
  return (
    <section className="border-y border-navy-border bg-navy-panel/40 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-orange">{kicker}</p>
        <h2 className="mt-2 text-center text-2xl font-bold text-white sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-ink-secondary sm:text-base">{lead}</p>
        <div className="mt-10 space-y-10">
          <MetaCsvWorkflowVideo id="homepage-workflow-animated" />
          <div>
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Full product walkthrough
            </p>
            <MetaWalkthroughVideo showChapters={false} showStepGuide id="homepage-video-walkthrough" />
          </div>
        </div>
        {showFullGuideLink ? (
          <p className="mt-6 text-center text-sm">
            <Link href="/help/download#video-walkthrough" className="font-medium text-accent-orange hover:underline">
              Step-by-step checklist on the CSV export guide →
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
