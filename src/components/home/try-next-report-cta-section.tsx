"use client";

import Link from "next/link";
import { useSiteCopy } from "@/hooks/use-site-copy";

export function TryNextReportCtaSection({ loggedIn }: { loggedIn: boolean }) {
  const { marketing } = useSiteCopy();

  return (
    <section className="border-t border-navy-border bg-navy-panel px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold text-white sm:text-3xl">{marketing.tryCtaTitle}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-secondary">{marketing.tryCtaSubtitle}</p>
      <div className="mt-6">
        <Link
          href={loggedIn ? "/clients" : "/signup"}
          className="inline-block rounded-md bg-accent-orange px-6 py-3 text-sm font-semibold text-navy hover:bg-accent-orange-hover"
        >
          {loggedIn ? marketing.tryCtaDashboard : marketing.tryCtaStartTrial}
        </Link>
      </div>
    </section>
  );
}
