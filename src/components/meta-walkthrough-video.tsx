"use client";

import Link from "next/link";
import { LoomVideoEmbed } from "@/components/loom-video-embed";
import { MetaWalkthroughChapters } from "@/components/meta-walkthrough-chapters";
import { loomShareUrl, metaWalkthroughLoomId } from "@/lib/marketing-videos";

/** Full Meta CSV export → NextReport wizard walkthrough (Loom + on-page steps). */
export function MetaWalkthroughVideo({
  showChapters = true,
  id = "video-walkthrough",
  className = "",
}: {
  showChapters?: boolean;
  id?: string;
  className?: string;
}) {
  const loomId = metaWalkthroughLoomId();
  if (!loomId) {
    return (
      <p className="rounded-lg border border-navy-border bg-navy-panel px-4 py-3 text-sm text-ink-secondary">
        Video walkthrough is unavailable (check{" "}
        <code className="text-xs text-ink-muted">NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID</code> — remove{" "}
        <code className="text-xs text-ink-muted">off</code> to show the default Loom).
      </p>
    );
  }

  return (
    <section id={id} className={`space-y-8 ${className}`.trim()}>
      <div>
        <LoomVideoEmbed
          loomId={loomId}
          title="Meta Ads Reporting CSV export and NextReport report wizard walkthrough"
        />
        <p className="mt-3 text-center text-xs text-ink-muted">
          Prefer to open in Loom?{" "}
          <Link href={loomShareUrl(loomId)} target="_blank" rel="noopener noreferrer" className="text-accent-orange hover:underline">
            Watch on loom.com
          </Link>
        </p>
      </div>
      {showChapters ? <MetaWalkthroughChapters /> : null}
    </section>
  );
}

/** Video player only (wizard import, compact panels). */
export function MetaWalkthroughVideoCompact({ id = "video-walkthrough" }: { id?: string }) {
  return <MetaWalkthroughVideo showChapters={false} id={id} className="space-y-0" />;
}
