import type { ReactNode } from "react";

type MarketingBand = "default" | "panel" | "inset" | "divider";

const BAND_CLASS: Record<MarketingBand, string> = {
  default: "nre-marketing-band-default bg-navy",
  panel: "nre-marketing-band-panel bg-navy-panel",
  inset: "nre-marketing-band-inset border-y border-navy-border bg-navy-panel/70",
  divider: "nre-marketing-band-divider border-t border-navy-border bg-navy",
};

export function MarketingSection({
  band = "default",
  className = "",
  children,
  id,
}: {
  band?: MarketingBand;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={`nre-marketing-section px-6 py-20 sm:py-24 ${BAND_CLASS[band]} ${className}`}>
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

export function MarketingSectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <header className={`max-w-3xl ${alignClass}`}>
      {eyebrow ? (
        <p className="nre-marketing-eyebrow inline-flex rounded-full border border-navy-border bg-navy-panel/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`text-2xl font-semibold tracking-tight text-white sm:text-3xl ${eyebrow ? "mt-4" : ""}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={`mt-3 text-sm leading-relaxed text-ink-muted sm:text-base ${align === "center" ? "max-w-2xl" : ""}`}>
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
