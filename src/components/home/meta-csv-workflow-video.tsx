"use client";

import { useState } from "react";

const POSTER = "/videos/meta-csv-workflow-poster-web.jpg";
const SRC = "/videos/meta-csv-workflow-web.mp4";

/**
 * Click-to-load player. The MP4 is not requested until play, so the
 * homepage does not download the film during the initial page load.
 */
export function MetaCsvWorkflowVideo({ id }: { id?: string }) {
  const [playing, setPlaying] = useState(false);

  if (!playing) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => setPlaying(true)}
        className="group relative block w-full overflow-hidden rounded-xl border border-navy-border bg-navy text-left shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]"
        aria-label="Play the 30-second NextReport walkthrough"
      >
        <img
          src={POSTER}
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="aspect-video w-full bg-black object-cover"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/35">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-orange text-navy shadow-lg">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-navy-border bg-navy shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]">
      <video
        id={id}
        className="aspect-video w-full bg-black"
        controls
        autoPlay
        playsInline
        preload="none"
        poster={POSTER}
        aria-label="How NextReport works with Meta Ads Manager CSV exports"
      >
        <source src={SRC} type="video/mp4" />
        Your browser does not support embedded video.
      </video>
    </div>
  );
}
