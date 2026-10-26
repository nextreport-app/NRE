/**
 * Public tutorial / walkthrough videos (YouTube preferred, Loom fallback, or self-hosted MP4 later).
 * Override via NEXT_PUBLIC_* env without a deploy-time code change.
 */

const DEFAULT_META_WALKTHROUGH_YOUTUBE_ID = "7LfSMNzepP4";

/** 30-second Meta CSV workflow film on the demo page. */
export const WORKFLOW_FILM_YOUTUBE_ID = "M6vd8ZnuXfI";

/** Shown on the YouTube thumbnail facade (matches your YouTube upload title). */
export const META_WALKTHROUGH_DISPLAY_TITLE = "NextReport Workflow Demo";
const DEFAULT_META_WALKTHROUGH_LOOM_ID = "b4b96b3b627048bfaa6cd544e00dd977";

export type MetaWalkthroughVideoSource =
  | { provider: "youtube"; videoId: string }
  | { provider: "loom"; loomId: string };

function isVideoIdDisabled(raw: string | undefined): boolean {
  const v = raw?.trim();
  return v === "off" || v === "false" || v === "";
}

export function metaWalkthroughYouTubeId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID?.trim();
  if (fromEnv !== undefined && isVideoIdDisabled(fromEnv)) return null;
  return fromEnv || DEFAULT_META_WALKTHROUGH_YOUTUBE_ID;
}

export function metaWalkthroughLoomId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID?.trim();
  if (fromEnv === "off" || fromEnv === "false") return null;
  return fromEnv || DEFAULT_META_WALKTHROUGH_LOOM_ID;
}

/** YouTube when enabled; otherwise Loom. */
export function metaWalkthroughVideoSource(): MetaWalkthroughVideoSource | null {
  const videoId = metaWalkthroughYouTubeId();
  if (videoId) return { provider: "youtube", videoId };
  const loomId = metaWalkthroughLoomId();
  if (loomId) return { provider: "loom", loomId };
  return null;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Static YouTube poster — loaded on our origin only as img, not the full player. */
export function youtubeThumbnailUrl(videoId: string, quality: "hq" | "max" = "hq"): string {
  const file = quality === "max" ? "maxresdefault.jpg" : "hqdefault.jpg";
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${file}`;
}

export function youtubeEmbedUrl(videoId: string, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (opts?.autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function loomShareUrl(loomId: string): string {
  return `https://www.loom.com/share/${loomId}`;
}

export function loomEmbedUrl(loomId: string): string {
  return `https://www.loom.com/embed/${loomId}`;
}
