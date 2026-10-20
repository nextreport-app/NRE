# Marketing walkthrough videos

## Loom (current default)

The Meta CSV → wizard walkthrough is embedded from Loom. **You do not need to download the MP4** to show it on nextreport.in — the site uses Loom’s embed player (`/help/download`, `/how-it-works`, and a link from the wizard Import step).

- Share URL: `https://www.loom.com/share/<id>`
- Embed URL: `https://www.loom.com/embed/<id>`
- Override id: set `NEXT_PUBLIC_LOOM_META_WALKTHROUGH_ID` in Vercel (use `off` to hide the embed).

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

## Recording checklist (matches product flow)

See also `docs/youtube-tutorial-script.md`. Your Loom script covers:

- Ads Manager live campaign → Ads Reporting → Create report
- Last 30 days → breakdown **Day** → select metrics → save view → Export CSV
- nextreport.in → dashboard → client → Generate report → Import → wizard → generate → preview / share

Record at **1920×1080**, browser zoom **100%**, hide bookmarks bar, blur sensitive account names if needed.
