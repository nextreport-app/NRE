"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function TryNextReportCtaSection({ loggedIn }: { loggedIn: boolean }) {
  const { marketing } = useSiteCopy();
  const hasSplitHeadline =
    marketing.tryCtaHeadlineAccent && marketing.tryCtaHeadlineBefore !== undefined;

  return (
    <section className="nre-bottom-cta border-t border-navy-border bg-navy-panel px-6 py-20 text-center sm:py-24">
      <div className="relative mx-auto max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
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
      <p className="mx-auto mt-4 max-w-md text-base text-ink-secondary sm:text-lg">{marketing.tryCtaSubtitle}</p>
      <div className="mt-8">
        <Link
          href={loggedIn ? "/clients" : "/signup"}
          className="nre-hero-cta-primary inline-flex items-center justify-center rounded-full px-8 py-3.5 text-sm font-semibold sm:text-base"
        >
          {loggedIn ? marketing.tryCtaDashboard : marketing.tryCtaStartTrial}
        </Link>
      </div>
      {marketing.tryCtaFinePrint ? (
        <p className="mx-auto mt-4 max-w-md text-xs text-ink-muted">{marketing.tryCtaFinePrint}</p>
      ) : null}
      </div>
    </section>
  );
}
