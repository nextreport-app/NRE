/**
 * Public tutorial / walkthrough videos (Loom, YouTube, or self-hosted MP4 later).
 * Override Loom id via NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID without a deploy-time code change.
 */

const DEFAULT_META_WALKTHROUGH_LOOM_ID = "b4b96b3b627048bfaa6cd544e00dd977";

export function metaWalkthroughLoomId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID?.trim();
  if (fromEnv === "off" || fromEnv === "false") return null;
  return fromEnv || DEFAULT_META_WALKTHROUGH_LOOM_ID;
}

export function loomShareUrl(loomId: string): string {
  return `https://www.loom.com/share/${loomId}`;
}

export function loomEmbedUrl(loomId: string): string {
  return `https://www.loom.com/embed/${loomId}`;
}
