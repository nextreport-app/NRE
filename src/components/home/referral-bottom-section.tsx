"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** Slim referral strip — sits above the final homepage CTA. */
export function ReferralBottomSection() {
  const { home } = useSiteCopy();

  return (
    <section className="border-t border-navy-border bg-navy px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-xl border border-navy-border bg-navy-panel px-6 py-5 text-center sm:text-left">
        <h2 className="text-lg font-semibold text-white">{home.referTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{home.referralLine}</p>
        <Link href="/refer" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
          {home.referLink}
        </Link>
      </div>
    </section>
  );
}
