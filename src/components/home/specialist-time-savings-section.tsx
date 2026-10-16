"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

/** ROI strip — placed above “Client reports in three moves”. */
export function SpecialistTimeSavingsSection() {
  const { home } = useSiteCopy();

  return (
    <section className="border-b border-navy-border bg-navy-panel px-6 py-10 sm:py-12">
      <p className="nre-marketing-card mx-auto max-w-3xl px-6 py-5 text-center text-base leading-relaxed text-ink-secondary sm:text-lg">
        {home.specialistTimeSavings}
      </p>
    </section>
  );
}
