"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function PainPointSection() {
  const { home } = useSiteCopy();

  return (
    <section className="border-t-4 border-accent-orange bg-navy px-6 py-20">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-[2rem] font-bold text-white">{home.painTitle}</h2>
        <p className="mt-5 text-base leading-relaxed text-ink-muted">{home.painBody}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
          <div className="rounded-xl border border-navy-border bg-navy-panel p-6">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{home.painWithoutLabel}</p>
            <p className="mt-2 text-xl font-semibold text-white">{home.painWithoutCalc}</p>
            <p className="mt-1 text-sm font-medium text-red-400">{home.painWithoutResult}</p>
          </div>

          <div className="hidden text-2xl font-bold text-accent-orange sm:block" aria-hidden="true">
            →
          </div>
          <div className="text-xl font-bold text-accent-orange sm:hidden" aria-hidden="true">
            ↓
          </div>

          <div className="rounded-xl border border-accent-orange/50 bg-navy-panel p-6">
            <p className="text-xs uppercase tracking-wide text-ink-muted">{home.painWithLabel}</p>
            <p className="mt-2 text-xl font-semibold text-white">{home.painWithCalc}</p>
            <p className="mt-1 text-sm font-medium text-accent-orange">{home.painWithResult}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
