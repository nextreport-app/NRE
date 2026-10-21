"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";
import { HomeFeatureIcon } from "@/components/icons/home-feature-icons";

export function FeaturesSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy-panel px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">{home.featuresTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">{home.featuresSubtitle}</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {home.features.map((feature, index) => {
            return (
              <div key={feature.title} className="rounded-xl border border-navy-border bg-navy p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-navy-border bg-navy-panel">
                  <HomeFeatureIcon index={index} />
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
