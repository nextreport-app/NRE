# Product launch scope

Updated 27 October 2026 for manual Meta acceptance after PR #588.

Only **Meta Ads** is selectable in the report wizard. Google Ads, TikTok Ads and GA4 remain hidden from report-wizard platform pickers until the owner tests and approves them. Connection management is visible in Account Settings and client settings for every platform, including GA4 property linking. The homepage lists these connections with an explicit reporting-testing status; marketing and SEO do not claim their report generation is live. Their implementations and existing report history remain intact. The direct GA4 creation page is unavailable while GA4 is hidden; saved non-Meta drafts are preserved without being restored into the active wizard.

**Report choices:** Weekly, Monthly, Daily, Month-by-month, Comparison and Daily breakdown are selectable for owner acceptance; Quarterly, Year-to-date and Creative are hidden while their implementations and saved reports remain intact. See [report-type simplification](./REPORT_TYPE_SIMPLIFICATION.md).

**Account Settings:** Google Ads, Google Analytics (GA4) and TikTok connection sections are visible for OAuth review and connection testing. This does not enable their report wizard flows or change OAuth scopes, credentials or approval status.

**Meta API sync is hidden inside the wizard**, including the disabled launching-soon option and all sync/reference/diagnostic controls. Saved API import preferences fall back to CSV. `isWizardApiSyncVisible()` gates the UI independently of `AD_PLATFORM_API_SYNC_ENABLED`; an existing true server flag cannot unhide wizard API controls. API handlers, stored connections and credentials remain intact for future testing. API correctness is still a separate acceptance task.

## Visible functionality

| Area | Included |
|------|----------|
| Platform | Meta Ads — manual CSV only |
| Report types | Weekly overview (default), Monthly, Daily, Month-by-month; Comparison and Daily breakdown under details |
| Output | Branded PPTX, share link, Google Slides, Google Drive, AI summaries |

Google sign-in, Drive/Slides exports and the site's analytics tag remain available. Existing privacy disclosures for optional OAuth grants are retained because hiding a product entry point does not delete stored connections or historical data.

## Restore after testing

- `src/lib/meta-launch-scope.ts`: expand `LAUNCH_ENABLED_PLATFORMS` and `LIVE_PRODUCT_PLATFORMS` only for approved platforms; update deferred lists/phase to match. Wizard pickers and the GA4 creation page consume the report availability policy; client connection visibility is independent.
- Update the public copy, pricing descriptions, translated taglines and SEO claims to describe the newly approved platform.
- `src/lib/ad-platform-api-sync.ts`: restore wizard API visibility deliberately after testing; existing server API configuration remains separate.

Google Ads Basic Access approval (15,000 operations/day, owner email dated 2 September) is distinct from OAuth scope verification and end-to-end report acceptance. The developer token belongs in the existing server-side GOOGLE_ADS_DEVELOPER_TOKEN configuration; never commit it. A successful GA4 OAuth connection does not certify report calculations or all metric availability.
