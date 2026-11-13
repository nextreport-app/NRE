"use client";

import type { ReactNode } from "react";

export function CampaignObjectiveReview({ name, objective, matched, needsConfirmation, source, children }: {
  name: string;
  objective: string;
  matched: boolean;
  needsConfirmation: boolean;
  source: "CSV" | "Meta API";
  children: ReactNode;
}) {
  const needsReview = !matched || needsConfirmation;
  return (
    <details open={needsReview} className={`group/objective ${needsReview ? 'bg-amber-500/5' : ''}`}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-dash-accent [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block break-words font-medium text-dash-ink">{name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-dash-ink-secondary">{objective || "Choose an objective"}</span>
            <span aria-hidden className="text-dash-ink-secondary">·</span>
            <span className={needsReview ? "font-medium text-dash-accent" : "text-emerald-400"}>{needsReview ? "Review objective" : `Matches ${source}`}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-dash-ink-secondary">
          <span className="group-open/objective:hidden">Change</span>
          <span className="hidden group-open/objective:inline">Close</span>
          <span aria-hidden className="transition-transform group-open/objective:rotate-180">⌄</span>
        </span>
      </summary>
      <div className="space-y-2 border-t border-dash-border bg-dash-bg/50 px-4 py-3">{children}</div>
    </details>
  );
}
