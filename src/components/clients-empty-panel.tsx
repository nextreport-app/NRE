"use client";

import Link from "next/link";
import { FirstRunHelpLinks } from "@/components/first-run-help-links";
import { useSiteCopy } from "@/hooks/use-site-copy";

/** Shown when the user has no clients and dismissed the getting-started guide. */
export function ClientsEmptyPanel() {
  const { dashboard: d } = useSiteCopy();

  return (
    <div className="rounded-2xl border border-dash-border bg-dash-card px-8 py-14 text-center sm:px-12">
      <div
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-dash-accent/15 text-2xl"
        aria-hidden="true"
      >
        👥
      </div>
      <h2 className="text-[20px] font-bold text-dash-ink">{d.emptyAddFirstClient}</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-dash-ink-secondary">{d.emptyBody}</p>
      <Link
        href="/clients/new"
        className="mt-8 inline-flex rounded-lg bg-dash-accent px-7 py-3 text-[15px] font-semibold text-dash-ink shadow-sm transition-colors hover:bg-dash-accent-hover"
      >
        {d.emptyAddClientCta}
      </Link>
      <FirstRunHelpLinks className="mx-auto mt-8 max-w-lg" />
    </div>
  );
}
