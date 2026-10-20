"use client";

import { loomEmbedUrl } from "@/lib/marketing-videos";

/** Responsive 16:9 Loom embed — no download required; works on Loom free share links. */
export function LoomVideoEmbed({
  loomId,
  title,
  className = "",
}: {
  loomId: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={`relative aspect-video min-h-[200px] w-full overflow-hidden rounded-lg border border-navy-border bg-navy sm:min-h-[240px] ${className}`.trim()}
    >
      <iframe
        src={loomEmbedUrl(loomId)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
