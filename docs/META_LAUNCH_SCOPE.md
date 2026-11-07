# Product launch scope

Updated November 7, 2026.

**Meta Ads reporting is live with manual CSV upload and read-only Meta API sync**, included in the trial and every paid plan. Both sources use the same campaign/objective detection, metric review, calculations, report builders and PPT renderers. See [the launch audit](META_API_LAUNCH_AUDIT.md) and [four-report contracts](FOUR_REPORT_WORKFLOWS.md).

The wizard offers four report choices: Weekly overview, Monthly report (one month or several), Compare two periods, and Daily report (one day or a range). Internal DAILY/HISTORICAL modes remain for compatibility. Quarterly, YTD and Creative report creation remain deferred; existing report history and implementations are preserved.

Google Ads, TikTok Ads and GA4 reporting remain **coming soon**, hidden from report-wizard platform selection. Their account connection settings remain available for setup/testing. Connecting them does not enable reporting. TikTok connection availability retains the existing India restriction; unknown location is not treated as India.

## Import behavior

New users see both import choices. Returning users see their remembered method in a compact summary with **Change import method**. The preference is per client in this browser; it is not behavioral tracking. Only the chosen import form is expanded. Switching sources clears stale imported data and preserves report settings and the manual-only previous-month preference.

Weekly API import automatically includes the rolling 30-day chart window and any additional selected reporting dates. Monthly, comparison and daily imports use their selected periods. Account currency/timezone remain part of source validation and date calculations, without being added to account-picker labels.

The optional stored previous-month CSV supplement remains manual-only by the owner's earlier instruction. This does not restrict explicitly selected monthly/comparison periods through API.

## Availability and permissions

`isWizardApiSyncVisible()` is true. API sync is enabled by default; `AD_PLATFORM_API_SYNC_ENABLED=false` remains an operational kill switch. No billing IDs, subscription limits, OAuth scopes or encryption keys change. Users require an active trial/subscription and their own connected Meta account. OAuth uses only `ads_read`, with no `ads_management` write permission.

Before public rollout, the owner must confirm Meta's app is in Live mode with the required `ads_read` access approved for external users. Existing successful owner/developer-account connections do not prove external-user eligibility. This Meta dashboard status cannot be verified from repository tests.

Production deployment is separate from this code change. Keep existing Meta credentials and stable token encryption configuration. If the API kill switch is explicitly false in Vercel, set it true or remove it before redeploying.
