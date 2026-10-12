"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function TestimonialsSection() {
  const { home } = useSiteCopy();

  return (
    <section className="border-t border-navy-border bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-sm font-medium uppercase tracking-widest text-accent">{home.testimonialsEyebrow}</p>
        <h2 className="mt-3 text-center text-3xl font-semibold text-white">{home.testimonialsTitle}</h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {home.testimonials.map((t) => (
            <blockquote
              key={t.quote.slice(0, 40)}
              className="rounded-xl border border-navy-border bg-navy-panel p-6 text-sm leading-relaxed text-ink-secondary"
            >
              <p className="text-ink-primary">&ldquo;{t.quote}&rdquo;</p>
              <footer className="mt-4 text-xs text-ink-muted">
                <span className="font-medium text-white">{t.role}</span>
                <span className="block">{t.company}</span>
                <span className="block">{t.location}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
