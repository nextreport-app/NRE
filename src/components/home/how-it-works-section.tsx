"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";
import { MarketingSection, MarketingSectionHeader } from "./marketing-section";

export function HowItWorksSection() {
  const { home } = useSiteCopy();

  return (
    <MarketingSection band="default">
      <MarketingSectionHeader title={home.howItWorksTitle} subtitle={home.howItWorksSubtitle} />

      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {home.howItWorksSteps.map((step, index) => (
          <article
            key={step.title}
            className="nre-marketing-card nre-marketing-card--interactive flex h-full flex-col p-6 text-left"
          >
            <span className="nre-marketing-step-index" aria-hidden="true">
              {index + 1}
            </span>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-white">{step.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{step.description}</p>
          </article>
        ))}
      </div>

      <p className="mt-10 text-center text-sm">
        <Link href="/how-it-works" className="font-medium text-accent-orange hover:underline">
          {home.howItWorksLink}
        </Link>
      </p>
    </MarketingSection>
  );
}
