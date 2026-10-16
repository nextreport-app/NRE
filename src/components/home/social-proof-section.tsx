"use client";

import { SocialProofCounter } from "@/components/home/social-proof-counter";

/** Live report count — below the fold, not in the hero. */
export function SocialProofSection({
  initial,
}: {
  initial: { totalReports: number; reportsLast7Days: number } | null;
}) {
  if (!initial || initial.totalReports <= 0) return null;

  return (
    <section className="border-y border-navy-border bg-navy-panel px-6 py-10" aria-label="Report activity">
      <div className="mx-auto flex max-w-5xl justify-center">
        <SocialProofCounter initial={initial} layout="section" />
      </div>
    </section>
  );
}
