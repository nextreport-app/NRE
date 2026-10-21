"use client";

import { useEffect, useState } from "react";
import { useSiteCopy } from "@/hooks/use-site-copy";

type Stats = { totalReports: number; reportsLast7Days: number };

function LivePulseDot() {
  return (
    <span
      className="nre-live-dot relative inline-flex h-2 w-2 shrink-0 rounded-full bg-emerald-400"
      aria-hidden="true"
    />
  );
}

export function SocialProofCounter({
  initial,
  layout = "inline",
}: {
  initial: Stats | null;
  layout?: "inline" | "section" | "merged";
}) {
  const { home } = useSiteCopy();
  const [stats, setStats] = useState<Stats | null>(initial);

  useEffect(() => {
    if (!initial) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const res = await fetch("/api/public/social-proof", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { enabled: boolean; totalReports?: number; reportsLast7Days?: number };
        if (cancelled || !data.enabled || data.totalReports == null || data.reportsLast7Days == null) return;
        setStats({ totalReports: data.totalReports, reportsLast7Days: data.reportsLast7Days });
      } catch {
        /* ignore — keep last known count */
      }
    };

    const id = window.setInterval(refresh, 45_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [initial]);

  if (!stats || stats.totalReports <= 0) return null;

  const totalText = home.socialProofTotal.replace("{count}", stats.totalReports.toLocaleString());
  const weekText =
    stats.reportsLast7Days > 0
      ? home.socialProofWeek.replace("{count}", stats.reportsLast7Days.toLocaleString())
      : null;

  if (layout === "merged") {
    return (
      <div
        className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-secondary"
        aria-live="polite"
      >
        <LivePulseDot />
        <span className="font-semibold text-white">{totalText}</span>
        {weekText ? (
          <>
            <span className="text-ink-muted/60" aria-hidden="true">
              ·
            </span>
            <span>{weekText}</span>
          </>
        ) : null}
        <span className="text-ink-muted/60" aria-hidden="true">
          ·
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-emerald-400/90">{home.socialProofLiveHint}</span>
      </div>
    );
  }

  const boxClass =
    layout === "section"
      ? "w-full max-w-md rounded-xl border border-navy-border bg-navy px-5 py-4 text-center"
      : "mt-6 rounded-xl border border-navy-border bg-navy-panel/80 px-4 py-3 text-left sm:inline-block";

  return (
    <div className={boxClass} aria-live="polite">
      <p className="text-sm font-semibold text-white">{totalText}</p>
      {weekText ? <p className="mt-0.5 text-xs text-ink-secondary">{weekText}</p> : null}
      <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">{home.socialProofLiveHint}</p>
    </div>
  );
}
