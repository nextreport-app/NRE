# Product launch scope

**Public messaging:** Only **Meta Ads CSV reporting** is **live**. **Meta Marketing API sync**, **Google Ads**, **TikTok Ads**, and **GA4** are **launching soon** (testing/finalization in progress).

**Engineering:** Platform pickers and account sections may remain visible when `LAUNCH_ENABLED_PLATFORMS` includes deferred platforms and/or `AD_PLATFORM_API_SYNC_ENABLED=true` for internal demos — that does not change customer-facing “live” claims.

## Live in production (customer promise)

| Area | Included |
|------|----------|
| **Platform** | Meta Ads — CSV upload from Ads Manager |
| **Report types** | Weekly, Monthly, Yesterday, Comparison, Historical, Day breakdown, Quarter, YTD, Creative (Meta CSV where supported) |
| **Output** | Branded PPTX, share link, Google Slides, Google Drive, AI summaries |

## Launching soon (not “live” in marketing)

- Meta Marketing API sync (`AD_PLATFORM_API_SYNC_ENABLED` — off by default)
- Google Ads (CSV + API)
- TikTok Ads (CSV + API)
- GA4 website reporting wizard

## Code switches

- `src/lib/meta-launch-scope.ts` — platform/report visibility + shared hero copy
- `src/lib/ad-platform-api-sync.ts` — API import + Connect UI (default off)
