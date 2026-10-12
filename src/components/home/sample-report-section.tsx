"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function SampleReportSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto w-full max-w-[80%] rounded-xl border-l-4 border-accent-orange bg-navy p-10 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{home.sampleTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">{home.sampleBody}</p>
          <a
            href="/sample-report.pptx"
            className="mt-8 inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
          >
            {home.sampleCta}
          </a>
          <p className="mt-4 text-xs text-ink-muted">{home.sampleFootnote}</p>
        </div>
      </div>
    </section>
  );
}
