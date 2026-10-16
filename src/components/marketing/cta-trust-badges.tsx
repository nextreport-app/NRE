"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

export function CtaTrustBadges({ className = "" }: { className?: string }) {
  const { marketing } = useSiteCopy();
  const items = marketing.ctaTrustBadges;
  if (!items?.length) return null;

  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-muted lg:justify-start ${className}`}
      aria-label="Trial and billing highlights"
    >
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5">
          <span className="text-accent-orange" aria-hidden="true">
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
