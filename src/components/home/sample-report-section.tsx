"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function SampleReportSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy-panel px-6 pt-8 pb-4 sm:pt-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 rounded-xl border-l-4 border-accent-orange bg-navy p-5 sm:p-6 md:flex-row md:items-center md:gap-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">{home.sampleTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{home.sampleBody}</p>
        </div>
        <div className="flex flex-col gap-2 md:w-64 md:shrink-0">
          <a
            href="/sample-report.pptx"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent-orange px-5 py-3 text-center text-sm font-semibold text-navy hover:bg-accent-orange-hover"
          >
            {home.sampleCta}
          </a>
          <p className="text-center text-xs leading-relaxed text-ink-muted">{home.sampleFootnote}</p>
        </div>
      </div>
    </section>
  );
}
