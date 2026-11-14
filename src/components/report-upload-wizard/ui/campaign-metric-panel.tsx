"use client";

import { useId, useState, type ReactNode } from "react";

export function CampaignMetricPanel({ name, objective, metricCount, slideCount, collapsible, initiallyExpanded, needsAttention, children }: {
  name: string;
  objective?: string;
  metricCount: number;
  slideCount: number;
  collapsible: boolean;
  initiallyExpanded: boolean;
  needsAttention: boolean;
  children: ReactNode;
}) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(initiallyExpanded || needsAttention);
  const [previousAttention, setPreviousAttention] = useState(needsAttention);
  // Reveal new validation issues without collapsing the panel after a repair.
  if (previousAttention !== needsAttention) {
    setPreviousAttention(needsAttention);
    if (needsAttention) setExpanded(true);
  }
  const open = !collapsible || expanded;
  const heading = <>
    <span className="min-w-0 flex-1">
      <span id={`${contentId}-name`} className="block break-words text-[15px] font-semibold text-dash-ink">{name}</span>
      <span id={`${contentId}-summary`} className="mt-1 block text-xs font-normal text-dash-ink-secondary">{metricCount} {metricCount === 1 ? "metric" : "metrics"} · {slideCount === 0 ? "Summary only" : `${slideCount} ${slideCount === 1 ? "slide" : "slides"}`}</span>
    </span>
    <span className="flex shrink-0 flex-wrap items-center gap-2">
      {objective && <span id={`${contentId}-objective`} className="rounded-md bg-dash-bg px-2 py-1 text-[11px] font-medium text-dash-ink-secondary">{objective}</span>}
      {needsAttention && <span id={`${contentId}-status`} className="text-xs font-medium text-dash-accent">Review metrics</span>}
    </span>
    {collapsible && <span aria-hidden className={`shrink-0 text-dash-ink-secondary transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>}
  </>;
  return <section className={`overflow-hidden rounded-lg border bg-dash-bg/30 ${needsAttention ? "border-dash-accent/60" : "border-dash-border"}`}>
    {collapsible ? <button type="button" aria-labelledby={`${contentId}-name`} aria-describedby={`${contentId}-summary${objective ? ` ${contentId}-objective` : ""}${needsAttention ? ` ${contentId}-status` : ""}`} aria-expanded={open} aria-controls={contentId} onClick={() => setExpanded(value => !value)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left focus-visible:outline-2 focus-visible:outline-dash-accent">{heading}</button>
      : <div className="flex flex-wrap items-center gap-3 p-4">{heading}</div>}
    <div id={contentId} hidden={!open} className="px-4 pb-4">{children}</div>
  </section>;
}
