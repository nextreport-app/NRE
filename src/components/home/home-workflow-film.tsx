"use client";

import { YouTubeVideoEmbed } from "@/components/youtube-video-embed";
import { WORKFLOW_FILM_YOUTUBE_ID } from "@/lib/marketing-videos";

/** Closing homepage block — 30s narrated workflow film, hosted on YouTube. */
export function HomeWorkflowFilm() {
  return (
    <section id="workflow-film" className="border-t border-navy-border bg-navy px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-accent-orange">30 seconds</p>
        <h2 className="mt-2 text-center text-2xl font-bold text-white sm:text-3xl">From a Meta CSV to a client deck</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-ink-secondary sm:text-base">
          A short walkthrough. Press play.
        </p>
        <div className="mt-8">
          <YouTubeVideoEmbed
            videoId={WORKFLOW_FILM_YOUTUBE_ID}
            title="Meta CSV to a client deck in 30 seconds"
            displayTitle="Meta CSV to a client deck in 30 seconds"
            autoplay
            className="rounded-xl shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]"
          />
        </div>
      </div>
    </section>
  );
}
