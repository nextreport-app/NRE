import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORKFLOW_FILM_YOUTUBE_ID,
  metaWalkthroughLoomId,
  metaWalkthroughVideoSource,
  metaWalkthroughYouTubeId,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
} from "../marketing-videos";

describe("marketing-videos", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults Meta walkthrough to YouTube", () => {
    expect(metaWalkthroughYouTubeId()).toBe("7LfSMNzepP4");
    expect(metaWalkthroughVideoSource()).toEqual({
      provider: "youtube",
      videoId: "7LfSMNzepP4",
    });
  });

  it("falls back to Loom when YouTube is off", () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID", "off");
    expect(metaWalkthroughVideoSource()).toEqual({
      provider: "loom",
      loomId: "b4b96b3b627048bfaa6cd544e00dd977",
    });
  });

  it("respects custom YouTube id", () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID", "custom123");
    expect(metaWalkthroughYouTubeId()).toBe("custom123");
  });

  it("builds YouTube thumbnail URL", () => {
    expect(youtubeThumbnailUrl("abc123")).toBe("https://i.ytimg.com/vi/abc123/hqdefault.jpg");
    expect(youtubeThumbnailUrl("abc123", "max")).toContain("maxresdefault.jpg");
  });

  it("builds YouTube embed URL with modest branding", () => {
    const url = new URL(youtubeEmbedUrl("7LfSMNzepP4"));
    expect(url.origin + url.pathname).toBe("https://www.youtube.com/embed/7LfSMNzepP4");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("modestbranding")).toBe("1");
    expect(url.searchParams.get("autoplay")).toBeNull();
  });

  it("points the homepage film at the uploaded walkthrough", () => {
    expect(WORKFLOW_FILM_YOUTUBE_ID).toBe("M6vd8ZnuXfI");
    expect(new URL(youtubeEmbedUrl(WORKFLOW_FILM_YOUTUBE_ID, { autoplay: true })).searchParams.get("autoplay")).toBe(
      "1",
    );
  });

  it("returns null when both providers disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID", "off");
    vi.stubEnv("NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID", "off");
    expect(metaWalkthroughVideoSource()).toBeNull();
    expect(metaWalkthroughLoomId()).toBeNull();
  });
});
