"use client";

/** Homepage explainer — animated Meta CSV → NextReport workflow (with audio via controls). */
export function MetaCsvWorkflowVideo({ id }: { id?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-navy-border bg-navy shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)]">
      <video
        id={id}
        className="aspect-video w-full bg-black"
        controls
        playsInline
        preload="metadata"
        aria-label="How NextReport works with Meta Ads Manager CSV exports"
      >
        <source src="/videos/meta-csv-workflow-demo.mp4" type="video/mp4" />
        Your browser does not support embedded video.
      </video>
    </div>
  );
}
