"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function HowItWorksSection() {
  const { home } = useSiteCopy();

  return (
    <section className="bg-navy px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">{home.howItWorksTitle}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-ink-muted">{home.howItWorksSubtitle}</p>

        <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {home.howItWorksSteps.map((step, index) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-orange text-lg font-bold text-navy">
                {index + 1}
              </div>
              <h3 className="mt-4 text-lg font-medium text-white">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{step.description}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm">
          <Link href="/how-it-works" className="text-accent-orange hover:underline">
            {home.howItWorksLink}
          </Link>
        </p>
      </div>
    </section>
  );
}
