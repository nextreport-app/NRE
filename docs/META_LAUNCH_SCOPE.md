# Product launch scope

Updated 27 October 2026 for manual Meta acceptance after PR #588.

Only **Meta Ads** is selectable in the report wizard. Google Ads, TikTok Ads and GA4 are temporarily hidden from platform pickers, client settings and public marketing/SEO copy until the owner tests and approves them. Their implementations and existing report history remain intact. The direct GA4 creation page is unavailable while GA4 is hidden; saved non-Meta drafts are preserved without being restored into the active wizard.

**Account Settings:** Google Ads, Google Analytics (GA4) and TikTok connection sections are visible for OAuth review and connection testing. This does not enable their report wizard flows or change OAuth scopes, credentials or approval status.

**Meta API sync stays visible with its existing experimental notice and existing server configuration.** This visibility change does not change `AD_PLATFORM_API_SYNC_ENABLED`, API handlers, OAuth credentials or calculation logic. API correctness is still a separate acceptance task.

## Visible functionality

| Area | Included |
|------|----------|
| Platform | Meta Ads — manual CSV and existing API testing controls |
| Report types | Weekly, Monthly, Yesterday, Comparison, Historical, Day breakdown, Quarter, YTD, Creative (where supported) |
| Output | Branded PPTX, share link, Google Slides, Google Drive, AI summaries |

Google sign-in, Drive/Slides exports and the site's analytics tag remain available. Existing privacy disclosures for optional OAuth grants are retained because hiding a product entry point does not delete stored connections or historical data.

## Restore after testing

- `src/lib/meta-launch-scope.ts`: expand `LAUNCH_ENABLED_PLATFORMS` and `LIVE_PRODUCT_PLATFORMS` only for approved platforms; update deferred lists/phase to match. Existing picker, settings and GA4 page consume this shared visibility policy.
- Update the public copy, pricing descriptions, translated taglines and SEO claims to describe the newly approved platform.
- `src/lib/ad-platform-api-sync.ts`: existing API import configuration is independent of platform visibility.
