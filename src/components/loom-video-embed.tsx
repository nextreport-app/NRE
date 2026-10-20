import { loomEmbedUrl } from "@/lib/marketing-videos";

/** Responsive 16:9 Loom embed — no download required; works on Loom free share links. */
export function LoomVideoEmbed({
  loomId,
  title,
}: {
  loomId: string;
  title: string;
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-navy-border bg-navy">
      <iframe
        src={loomEmbedUrl(loomId)}
        title={title}
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
