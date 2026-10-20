"use client";

import { useEffect, useRef, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/marketing-videos";

/**
 * YouTube iframes are heavy on mobile. Default: facade — iframe loads only after Play.
 */
export function YouTubeVideoEmbed({
  videoId,
  title,
  className = "",
  loadStrategy = "click",
  activateWhenHash,
}: {
  videoId: string;
  title: string;
  className?: string;
  loadStrategy?: "click" | "inView";
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
            Video loads from YouTube when you tap play — the rest of the page stays fast.
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={shellClass}>
      <iframe
        src={youtubeEmbedUrl(videoId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0 bg-[#0d1b2e]"
      />
    </div>
  );
}
