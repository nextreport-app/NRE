"use client";

import { LoomVideoEmbed } from "@/components/loom-video-embed";
import { MetaWalkthroughChapters } from "@/components/meta-walkthrough-chapters";
import { MetaWalkthroughStepGuide } from "@/components/meta-walkthrough-step-guide";
import { YouTubeVideoEmbed } from "@/components/youtube-video-embed";
import { metaWalkthroughVideoSource } from "@/lib/marketing-videos";

const WALKTHROUGH_TITLE = "Meta Ads Reporting CSV export and NextReport report wizard walkthrough";

/** Full Meta CSV export → NextReport wizard walkthrough (YouTube or Loom + on-page steps). */
export function MetaWalkthroughVideo({
  showChapters = true,
  showStepGuide = true,
  id = "video-walkthrough",
  className = "",
  loomLoadStrategy = "click",
}: {
  showChapters?: boolean;
  /** Floating step guide for silent videos. */
  showStepGuide?: boolean;
  id?: string;
  className?: string;
  /** Applies to YouTube and Loom embeds. */
  loomLoadStrategy?: "click" | "inView";
}) {
  const source = metaWalkthroughVideoSource();
  if (!source) {
    return (
      <p className="rounded-lg border border-navy-border bg-navy-panel px-4 py-3 text-sm text-ink-secondary">
        Video walkthrough is unavailable (set{" "}
        <code className="text-xs text-ink-muted">NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID</code> or{" "}
        <code className="text-xs text-ink-muted">NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID</code> — avoid{" "}
        <code className="text-xs text-ink-muted">off</code> on both).
      </p>
    );
  }

  const hashActivate = id === "video-walkthrough" ? "#video-walkthrough" : undefined;

  return (
    <section id={id} className={`space-y-8 ${className}`.trim()}>
      <div>
        {showStepGuide ? (
          <div className="mb-3 flex justify-end">
            <MetaWalkthroughStepGuide />
          </div>
        ) : null}
        {source.provider === "youtube" ? (
          <YouTubeVideoEmbed
            videoId={source.videoId}
            title={WALKTHROUGH_TITLE}
            loadStrategy={loomLoadStrategy}
            activateWhenHash={hashActivate}
          />
        ) : (
          <LoomVideoEmbed
            loomId={source.loomId}
            title={WALKTHROUGH_TITLE}
            loadStrategy={loomLoadStrategy}
            activateWhenHash={hashActivate}
          />
        )}
      </div>
      {showChapters ? <MetaWalkthroughChapters /> : null}
    </section>
  );
}

/** Video player only (wizard import, compact panels). */
export function MetaWalkthroughVideoCompact({ id = "video-walkthrough" }: { id?: string }) {
  return (
    <MetaWalkthroughVideo showChapters={false} showStepGuide={false} id={id} className="space-y-0" />
  );
}
