"use client";

import { useSiteCopy } from "@/hooks/use-site-copy";

function trustSegments(raw: string): string[] {
  if (raw.includes(" · ")) {
    return raw.split(" · ").map((s) => s.trim()).filter(Boolean);
  }
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.length > 1 ? sentences : [raw];
}

export function TrustStrip() {
  const { home } = useSiteCopy();
  const segments = trustSegments(home.trustStrip);

  return (
    <div className="border-y border-navy-border bg-navy-panel px-4 py-5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 sm:gap-3">
        {segments.map((segment) => (
          <span
            key={segment}
            className="rounded-full border border-navy-border bg-navy px-3 py-1.5 text-[11px] font-medium leading-snug text-ink-secondary sm:text-xs"
          >
            {segment}
          </span>
        ))}
      </div>
    </div>
  );
}
