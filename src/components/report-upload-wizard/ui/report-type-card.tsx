"use client";

import { useId, useState, type ReactNode } from "react";
import { ComingSoonBadge } from "@/components/coming-soon-badge";
import { PlatformBetaBadge } from "@/components/platform-beta-badge";

export function ReportTypeCard({
  icon,
  heading,
  description,
  detailTooltip,
  selected,
  onSelect,
  disabled = false,
  singleLineHeading = false,
  layout = "vertical",
  beta = false,
  comingSoon = false,
  recommended = false,
}: {
  icon: ReactNode;
  heading: string;
  description: string;
  /** Full “what you get” copy — compact layout shows this in a hover/tap popover instead of inline. */
  detailTooltip?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  singleLineHeading?: boolean;
  /** Compact centered cards — icon on top, text below (Report Type grid). */
  layout?: "vertical" | "compact";
  beta?: boolean;
  comingSoon?: boolean;
  /** Highlights the default choice (e.g. Weekly). */
  recommended?: boolean;
}) {
  const showSoonBadge =
    comingSoon && !/launching soon/i.test(description.trim());

  const stateClass = disabled
    ? "cursor-not-allowed border-dash-border bg-dash-bg/50 opacity-60"
    : selected
      ? "border-dash-accent bg-dash-accent/10"
      : "border-dash-border bg-dash-bg hover:bg-dash-border/30";

  const tooltipId = useId();
  const [detailOpen, setDetailOpen] = useState(false);
  const showInlineDescription = layout === "compact" ? !detailTooltip && description.trim().length > 0 : true;

  if (layout === "compact") {
    return (
      <div
        className={`group/card relative rounded-lg ${detailTooltip ? "max-sm:static" : ""}`}
        onMouseLeave={() => setDetailOpen(false)}
      >
        {detailTooltip ? (
          <div
            id={tooltipId}
            role="tooltip"
            className={`pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-[min(300px,calc(100vw-2.5rem))] -translate-x-1/2 rounded-lg border border-dash-border bg-[#0a1628] px-3 py-2.5 text-left shadow-xl transition-opacity duration-150 ${
              detailOpen ? "opacity-100" : "opacity-0 max-sm:opacity-0 [@media(hover:hover)]:group-hover/card:opacity-100 [@media(hover:hover)]:group-focus-within/card:opacity-100"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-dash-accent">What you get</p>
            <p className="mt-1 text-[12px] leading-snug text-dash-ink">{detailTooltip}</p>
          </div>
        ) : null}

        {detailTooltip ? (
          <button
            type="button"
            aria-label={`What's in the ${heading}`}
            aria-expanded={detailOpen}
            aria-controls={tooltipId}
            disabled={disabled}
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold text-dash-ink-secondary hover:bg-dash-border/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-dash-accent/60 [@media(hover:hover)]:hidden"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDetailOpen((open) => !open);
            }}
          >
            i
          </button>
        ) : null}

        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-pressed={selected}
          aria-describedby={detailTooltip ? tooltipId : undefined}
          className={`relative flex w-full flex-col items-center rounded-lg border px-3 py-3 text-center transition-colors ${stateClass}`}
        >
          <span className="inline-flex shrink-0 text-[26px] leading-none" aria-hidden="true">
            {icon}
          </span>
          <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="block text-[13px] font-semibold leading-snug text-white">{heading}</span>
            {recommended ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                Recommended
              </span>
            ) : null}
            {showSoonBadge ? <ComingSoonBadge /> : null}
            {!showSoonBadge && beta ? <PlatformBetaBadge /> : null}
          </span>
          {showInlineDescription ? (
            <span className="mt-1 block text-[12px] leading-snug text-dash-ink-secondary">{description}</span>
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`rounded-lg border p-4 text-left transition-colors ${stateClass}`}
    >
      <span className="inline-flex shrink-0" aria-hidden="true">
        {icon}
      </span>
      <p
        className={`mt-2 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-white${singleLineHeading ? "" : ""}`}
      >
        <span className={singleLineHeading ? "whitespace-nowrap" : undefined}>{heading}</span>
        {showSoonBadge ? <ComingSoonBadge /> : null}
        {!showSoonBadge && beta ? <PlatformBetaBadge /> : null}
      </p>
      <p className="mt-1 text-[14px] text-dash-ink-secondary">{description}</p>
    </button>
  );
}
