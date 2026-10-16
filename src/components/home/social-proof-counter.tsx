"use client";

import { useEffect, useState } from "react";
import { useSiteCopy } from "@/hooks/use-site-copy";

type Stats = { totalReports: number; reportsLast7Days: number };

export function SocialProofCounter({ initial }: { initial: Stats | null }) {
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

  return (
    <div
      className="mt-6 rounded-xl border border-navy-border bg-navy-panel/80 px-4 py-3 text-left sm:inline-block"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-white">
        {home.socialProofTotal.replace("{count}", stats.totalReports.toLocaleString())}
      </p>
      {stats.reportsLast7Days > 0 ? (
        <p className="mt-0.5 text-xs text-ink-secondary">
          {home.socialProofWeek.replace("{count}", stats.reportsLast7Days.toLocaleString())}
        </p>
      ) : null}
      <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-muted">{home.socialProofLiveHint}</p>
    </div>
  );
}
