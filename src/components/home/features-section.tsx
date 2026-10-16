"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";
import { MarketingSection, MarketingSectionHeader } from "./marketing-section";

const FEATURE_ICONS = ["📊", "📅", "🎯", "🤖", "🔀", "🌐"] as const;

export function FeaturesSection() {
  const { home } = useSiteCopy();

  return (
    <MarketingSection band="panel">
      <MarketingSectionHeader title={home.featuresTitle} subtitle={home.featuresSubtitle} />

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {home.features.slice(0, FEATURE_ICONS.length).map((feature, index) => {
          return (
            <article
              key={feature.title}
              className="nre-marketing-card nre-marketing-card--interactive p-6"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-navy-border bg-navy text-xl"
                aria-hidden="true"
              >
                {FEATURE_ICONS[index] ?? "✦"}
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.description}</p>
            </article>
          );
        })}
      </div>
    </MarketingSection>
  );
}
