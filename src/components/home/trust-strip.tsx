"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function TrustStrip() {
  const { home } = useSiteCopy();

  return (
    <div className="border-y border-navy-border bg-navy-panel px-4 py-4">
      <p className="mx-auto max-w-6xl overflow-x-auto text-center text-xs whitespace-nowrap text-ink-muted sm:text-sm">
        {home.trustStrip}
      </p>
    </div>
  );
}
