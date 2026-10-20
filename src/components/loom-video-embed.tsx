"use client";

import { useEffect, useRef, useState } from "react";
import { loomEmbedUrl } from "@/lib/marketing-videos";

/**
 * Loom iframes pull in heavy third-party JS and block the main thread on mobile.
 * Default: facade — iframe `src` is set only after the user clicks Play.
 */
export function LoomVideoEmbed({
  loomId,
  title,
  className = "",
  loadStrategy = "click",
  activateWhenHash,
}: {
  loomId: string;
  title: string;
  className?: string;
  /** `click` (default) or load when scrolled near viewport (still one iframe, not on first paint). */
  loadStrategy?: "click" | "inView";
  /** e.g. `#video-walkthrough` — auto-activate when URL hash matches (CSV guide deep links). */
  activateWhenHash?: string;
}) {
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activateWhenHash || typeof window === "undefined") return;
    if (window.location.hash === activateWhenHash) {
      setActive(true);
    }
  }, [activateWhenHash]);

  useEffect(() => {
    if (loadStrategy !== "inView" || active) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px", threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadStrategy, active]);

  const shellClass =
    `relative aspect-video min-h-[200px] w-full overflow-hidden rounded-lg border border-navy-border bg-[#0d1b2e] sm:min-h-[240px] ${className}`.trim();

  if (!active) {
    return (
      <div ref={containerRef} className={shellClass}>
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-[#111f35]"
          aria-label={`Play video: ${title}`}
        >
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-orange text-lg text-navy shadow-md transition-transform group-hover:scale-105"
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="text-sm font-semibold text-white">Play walkthrough</span>
          <span className="max-w-sm text-xs leading-relaxed text-ink-muted">
            Video loads from Loom when you tap play — the rest of the page stays fast.
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={shellClass}>
      <iframe
        src={loomEmbedUrl(loomId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0 bg-[#0d1b2e]"
      />
    </div>
  );
}
