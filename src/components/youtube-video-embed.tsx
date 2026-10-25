"use client";

import { useEffect, useRef, useState } from "react";
import { META_WALKTHROUGH_DISPLAY_TITLE, youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/marketing-videos";

/**
 * YouTube iframes are heavy on mobile. Default: thumbnail facade — iframe loads only after Play.
 */
export function YouTubeVideoEmbed({
  videoId,
  title,
  displayTitle = META_WALKTHROUGH_DISPLAY_TITLE,
  className = "",
  loadStrategy = "click",
  activateWhenHash,
  autoplay = false,
}: {
  videoId: string;
  title: string;
  /** Title overlay on the thumbnail (YouTube-style). */
  displayTitle?: string;
  className?: string;
  loadStrategy?: "click" | "inView";
  activateWhenHash?: string;
  /** Start playback when the iframe mounts (after the visitor presses play). */
  autoplay?: boolean;
}) {
  const [active, setActive] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(() => youtubeThumbnailUrl(videoId, "max"));
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
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN poster; avoids next/image remote config */}
        <img
          src={thumbSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => {
            if (thumbSrc.includes("maxresdefault")) {
              setThumbSrc(youtubeThumbnailUrl(videoId, "hq"));
            }
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/30" aria-hidden="true" />
        <div className="pointer-events-none absolute left-3 top-3 right-14 z-[1]">
          <p className="line-clamp-2 text-sm font-semibold text-white drop-shadow-md">{displayTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setActive(true)}
          className="absolute inset-0 z-[2] flex items-center justify-center"
          aria-label={`Play video: ${title}`}
        >
          <span
            className="flex h-[68px] w-[68px] items-center justify-center rounded-2xl bg-[#ff0000] shadow-lg transition-transform hover:scale-105"
            aria-hidden="true"
          >
            <span
              className="ml-1 h-0 w-0 border-y-[14px] border-l-[22px] border-y-transparent border-l-white"
              style={{ borderRight: 0 }}
            />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={shellClass}>
      <iframe
        src={youtubeEmbedUrl(videoId, { autoplay })}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0 bg-[#0d1b2e]"
      />
    </div>
  );
}
