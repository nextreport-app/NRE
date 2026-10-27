"use client";
import { useEffect, useRef } from "react";
/** Optional settings stay available; a deep link opens the containing panel before scrolling. */
export function SettingsDisclosure({ id, title, hint, children, defaultOpen = false }: { id?: string; title: string; hint?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function openLinkedPanel() {
      let hash: string;
      try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (!hash || !ref.current) return;
      const target = document.getElementById(hash);
      if (target && (target === ref.current || ref.current.contains(target))) { ref.current.open = true; requestAnimationFrame(() => target.scrollIntoView({ block: "start" })); }
    }
    openLinkedPanel(); window.addEventListener("hashchange", openLinkedPanel);
    return () => window.removeEventListener("hashchange", openLinkedPanel);
  }, []);
  return <details ref={ref} id={id} open={defaultOpen} className="group/settings overflow-hidden rounded-xl border border-dash-border bg-dash-card scroll-mt-6">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 focus-visible:outline-2 focus-visible:outline-dash-accent [&::-webkit-details-marker]:hidden"><span><span className="block text-[15px] font-semibold text-dash-ink">{title}</span>{hint && <span className="mt-1 block text-[13px] leading-relaxed text-dash-ink-secondary">{hint}</span>}</span><span aria-hidden className="text-dash-ink-secondary transition-transform group-open/settings:rotate-180">▾</span></summary>
    <div className="border-t border-dash-border p-4 sm:p-5">{children}</div>
  </details>;
}
