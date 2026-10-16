"use client";

import { SocialProofCounter } from "@/components/home/social-proof-counter";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** CSV integrity message + live report count in one compact band. */
export function TrustAndSocialProofStrip({
  initial,
}: {
  initial: { totalReports: number; reportsLast7Days: number } | null;
}) {
  const { home } = useSiteCopy();
  const showCounter = initial != null && initial.totalReports > 0;

  return (
    <section className="border-y border-navy-border bg-navy-panel px-6 py-6 sm:py-7" aria-label="Trust and activity">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm leading-relaxed text-ink-muted sm:text-[15px]">{home.trustStrip}</p>
        {showCounter ? (
          <div className="mt-4 border-t border-navy-border pt-4">
            <SocialProofCounter initial={initial} layout="merged" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
