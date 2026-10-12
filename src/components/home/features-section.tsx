"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

const FEATURE_ICONS = ["📊", "📅", "🎯", "🤖", "🔀", "🌐", "📈", "🎵"] as const;

export function FeaturesSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">{home.featuresTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">{home.featuresSubtitle}</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {home.features.map((feature, index) => {
            const live = index < 6;
            return (
              <div
                key={feature.title}
                className={`rounded-xl border bg-navy p-6 ${live ? "border-navy-border" : "border-navy-border/80 opacity-90"}`}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-panel text-xl"
                  aria-hidden="true"
                >
                  {FEATURE_ICONS[index] ?? "✦"}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
