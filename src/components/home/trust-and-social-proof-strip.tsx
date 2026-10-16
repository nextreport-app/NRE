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
    <section className="border-y border-navy-border bg-navy-panel px-4 py-5 sm:px-6 sm:py-6" aria-label="Trust and activity">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[13px] leading-snug text-ink-muted sm:text-sm sm:leading-normal md:whitespace-nowrap">
          {home.trustStrip}
        </p>
        {showCounter ? (
          <div className="mt-3 flex justify-center sm:mt-3.5">
            <div className="rounded-full border border-navy-border bg-navy/80 px-4 py-2 sm:px-5">
              <SocialProofCounter initial={initial} layout="merged" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
