"use client";

import type { ReactNode } from "react";

export function ReportTypeCard({
  icon,
  heading,
  description,
  selected,
  onSelect,
  disabled = false,
  singleLineHeading = false,
  layout = "vertical",
}: {
  icon: ReactNode;
  heading: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  singleLineHeading?: boolean;
  /** Compact centered cards — icon on top, text below (Report Type grid). */
  layout?: "vertical" | "compact";
}) {
  const stateClass = disabled
    ? "cursor-not-allowed border-dash-border bg-dash-bg/50 opacity-60"
    : selected
      ? "border-dash-accent bg-dash-accent/10"
      : "border-dash-border bg-dash-bg hover:bg-dash-border/30";

  if (layout === "compact") {
    return (
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-pressed={selected}
        className={`flex flex-col items-center rounded-lg border px-3 py-3 text-center transition-colors ${stateClass}`}
      >
        <span className="inline-flex shrink-0 text-[26px] leading-none" aria-hidden="true">
          {icon}
        </span>
        <span className="mt-2 block text-[13px] font-semibold leading-snug text-white">{heading}</span>
        <span className="mt-1 block text-[12px] leading-snug text-dash-ink-secondary">{description}</span>
      </button>
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
        className={`mt-2 text-[15px] font-semibold text-white${singleLineHeading ? " whitespace-nowrap" : ""}`}
      >
        {heading}
      </p>
      <p className="mt-1 text-[14px] text-dash-ink-secondary">{description}</p>
    </button>
  );
}
