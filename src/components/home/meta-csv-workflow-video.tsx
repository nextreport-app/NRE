"use client";

/** Homepage explainer — animated Meta CSV → NextReport workflow (with audio via controls). */
export function MetaCsvWorkflowVideo({ id }: { id?: string }) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-navy-border bg-navy shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]">
        <video
          id={id}
          className="aspect-video w-full bg-black"
          controls
          playsInline
          preload="metadata"
          poster="/videos/meta-csv-workflow-poster.jpg"
          aria-label="How NextReport works with Meta Ads Manager CSV exports"
        >
          <source src="/videos/meta-csv-workflow-male.mp4" type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      </div>
      <p className="text-center text-xs text-ink-muted">
        Male narration with a quiet music bed. Press play, then unmute.
      </p>
    </div>
  );
}
