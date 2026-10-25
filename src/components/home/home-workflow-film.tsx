"use client";

import { MetaCsvWorkflowVideo } from "@/components/home/meta-csv-workflow-video";

/** Closing homepage block — 30s narrated workflow film. */
export function HomeWorkflowFilm() {
  return (
    <section id="workflow-film" className="border-t border-navy-border bg-navy px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-orange">30 seconds</p>
        <h2 className="mt-2 text-center text-2xl font-bold text-white sm:text-3xl">From a Meta CSV to a client deck</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-ink-secondary sm:text-base">
          A short narrated walkthrough with a quiet music bed. Press play, then unmute.
        </p>
        <div className="mt-8">
          <MetaCsvWorkflowVideo id="homepage-workflow-film" />
        </div>
      </div>
    </section>
  );
}
