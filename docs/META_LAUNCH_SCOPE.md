# Product launch scope

**Phase:** `multi-platform`

## Live in product UI

| Area | Included |
|------|----------|
| **Platforms** | Meta Ads, Google Ads, TikTok Ads, GA4 website reporting |
| **Ingestion** | Manual CSV upload + read-only API sync (Meta / Google / TikTok) where connected |
| **Report types** | Weekly, Monthly, Yesterday (Daily), Comparison, Multi-Month Historical, Day-by-Day Table, Quarterly, YTD, Creative (ad-level) |
| **Output** | Branded PPTX, share link, Google Slides, Google Drive, AI summaries |

## Engineering invariants

1. **One pipeline:** API sync synthesizes CSV rows → same parsers → `buildReportData` as manual upload where applicable.
2. **Golden fixtures:** CI parity tests on anonymized accounts — see `src/lib/nre/__tests__/meta-golden-parity.test.ts` and related suites.
3. **API sync kill switch:** Set `AD_PLATFORM_API_SYNC_ENABLED=false` on Vercel to hide Connect CTAs and wizard “Sync from API” (CSV-only mode).

## Code switches

- `src/lib/meta-launch-scope.ts` — `LAUNCH_ENABLED_PLATFORMS`, `LAUNCH_ENABLED_REPORT_TYPES`
- `src/lib/ad-platform-api-sync.ts` — API import default on unless env `false`
