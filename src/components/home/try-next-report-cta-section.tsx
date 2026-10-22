"use client";

import Link from "next/link";
import { CtaTrustBadges } from "@/components/marketing/cta-trust-badges";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function TryNextReportCtaSection({ loggedIn }: { loggedIn: boolean }) {
  const { marketing } = useSiteCopy();
  const hasSplitHeadline =
    marketing.tryCtaHeadlineAccent && marketing.tryCtaHeadlineBefore !== undefined;

  return (
    <section className="nre-keep-dark-surface nre-bottom-cta border-t border-navy-border bg-navy-panel px-6 py-10 text-center sm:py-12">
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {hasSplitHeadline ? (
          <>
            {marketing.tryCtaHeadlineBefore}
            <span className="nre-marketing-accent-phrase text-accent-orange">
              {marketing.tryCtaHeadlineAccent}
            </span>
            {marketing.tryCtaHeadlineAfter}
          </>
        ) : (
          marketing.tryCtaTitle
        )}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-base text-ink-secondary sm:mt-3">{marketing.tryCtaSubtitle}</p>
      <div className="mx-auto mt-5 flex max-w-lg flex-col items-center sm:mt-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={loggedIn ? "/clients" : "/signup"}
            className="nre-hero-cta-primary inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold sm:text-base"
          >
            {loggedIn ? marketing.tryCtaDashboard : marketing.tryCtaStartTrial}
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full border border-navy-border bg-navy/80 px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:border-ink-muted hover:bg-navy"
          >
            {marketing.navContact}
          </Link>
        </div>
        <CtaTrustBadges className="mt-4 w-full justify-center" />
      </div>
    </section>
  );
}
