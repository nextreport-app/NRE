# Marketing walkthrough videos

## YouTube (current default)

The Meta CSV → wizard walkthrough is embedded from **YouTube** (click-to-play facade — no iframe until the user taps Play). Default video: `7LfSMNzepP4` (`https://youtu.be/7LfSMNzepP4`).

- Override id: `NEXT_PUBLIC_YOUTUBE_META_WALKTHROUGH_ID` in Vercel (use `off` to hide YouTube and fall back to Loom).
- Same embed on:

## Loom (fallback)

If YouTube is set to `off`, the site uses the previous Loom embed on:

- `/` (homepage, below hero)
- `/book-demo`
- `/help/download` (+ numbered checklist)
- `/how-it-works`
- `/clients` when you have no clients yet (getting started)
- Report wizard → **Import** step (Meta), embedded panel

- Share URL: `https://www.loom.com/share/<id>`
- Override Loom id: `NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID` (use `off` when using YouTube only).

**Performance:** embeds use a **Play walkthrough** facade — the YouTube/Loom iframe loads only after click (or when opening `/help/download#video-walkthrough`). Do not auto-load iframes on the homepage; third-party players are heavy on mobile.

### Getting an MP4 from Loom

Loom’s **download** button is on paid plans. On the free plan, legitimate options:

1. **Keep using embed** (recommended) — same video, no file on your server.
2. **Upgrade Loom** briefly, download once, then self-host or upload to YouTube.
3. **Re-record with a free recorder** that saves MP4 locally:
   - **OBS Studio** (Windows/macOS/Linux)
   - **macOS**: QuickTime → File → New Screen Recording
   - **Windows**: Xbox Game Bar (Win+G) or Snipping Tool (screen record)
4. **YouTube (unlisted)** — upload the MP4, embed with `youtube.com/embed/...` (good for SEO and mobile; no Loom branding).

Avoid third-party “Loom downloader” sites — they often break ToS and can inject malware.

## Self-hosted MP4 (optional future)

1. Export MP4 (1080p, H.264).
2. Place in `public/videos/meta-walkthrough.mp4` (or upload to Vercel Blob and use a `<video>` tag).
3. Swap `MetaWalkthroughVideo` to a `<video controls src="...">` component when you want zero third-party dependency.

## On-page steps + voiceover

- **User-facing checklist:** rendered from `src/lib/meta-walkthrough-script.ts` next to the Loom embed.
- **Narration script:** `docs/meta-walkthrough-voiceover.md` — paste into Loom speaker notes or read while re-recording.

## Recording checklist (matches product flow)

See also `docs/youtube-tutorial-script.md` and `docs/meta-walkthrough-voiceover.md`. Your Loom script covers:

- Ads Manager live campaign → Ads Reporting → Create report
- Last 30 days → breakdown **Day** → select metrics → save view → Export CSV
- nextreport.in → dashboard → client → Generate report → Import → wizard → generate → preview / share

Record at **1920×1080**, browser zoom **100%**, hide bookmarks bar, blur sensitive account names if needed.
