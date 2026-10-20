import Link from "next/link";
import { LoomVideoEmbed } from "@/components/loom-video-embed";
import { MetaWalkthroughChapters } from "@/components/meta-walkthrough-chapters";
import { loomShareUrl, metaWalkthroughLoomId } from "@/lib/marketing-videos";

/** Full Meta CSV export → NextReport wizard walkthrough (Loom + on-page steps). */
export function MetaWalkthroughVideo({ showChapters = true }: { showChapters?: boolean }) {
  const loomId = metaWalkthroughLoomId();
  if (!loomId) return null;

  return (
    <section id="video-walkthrough" className="space-y-8">
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
