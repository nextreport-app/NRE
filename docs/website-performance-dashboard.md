# GA4 website performance dashboard (Beta)

Overview → Website traffic (GA4), or Client Manage → Google Analytics property → View website performance. The website dashboard is separate from Meta ad performance; GA4 sees paid, organic, direct, referral and other website traffic according to its own channel attribution. GA4 reports and other ad platforms remain gated; marketing/pricing platform scope is unchanged.

## Setup and use

1. Connect Google Analytics in Account settings. This read-only grant is independent of Google Drive, Meta and Google Ads. The GA4 connection now has its own visible account section; Google Ads/TikTok remain collapsed.
2. On the right client's Manage page, Load GA4 properties, select the website property and Save property. Linking verifies access and uses Google's actual property name. Switching/unlinking clears that client's cached dashboard records atomically. Failed unlink/disconnect requests show an error instead of claiming success. No property is automatically assigned to any client.
3. Open Website traffic, select the client and Last 7 or Last 30 days, then Refresh GA4. Each window has a separate cache. Selecting 30 days never relabels a seven-day snapshot. Initial load, account switching and date-tab switching read cache only; they do not call Google. A successful snapshot less than five minutes old is reused with a visible notice. Refresh failures retain prior figures, marked as failed/stale.
4. The property’s **GA4 timezone**, fetched from Admin API, defines the completed days and preceding equal window. The client's Meta timezone/currency are not used to reinterpret website traffic. Today is excluded; GA4 data can still take 24–48 hours to settle.

For owner acceptance, use a separate **NextReport website** client linked to property **552954256** under the already-connected Google account. Do not link that property to Express Text: it is a different business/website. No production property was linked or modified during development.

Current change signals and channel comparison semantics are documented in [website change analysis](website-change-analysis.md).

## Data contract

- Period overview is parsed from GA4 dimensionless **rows**, not from absent `totals` or sums of daily users. Total users are unique over the whole period; new users and sessions are separate metrics.
- Core metrics: sessions, total/new users, engaged sessions, engagement/bounce rates, page views, key events, session key-event rate and average session duration. Modern `keyEvents` is used. `sessionKeyEventRate` comes from GA4; dividing key-event count by sessions would not be a valid session conversion rate.
- Current and previous period session-default-channel groups are preserved, including Organic Search, Organic Social, Paid Social, Paid Search, Cross-network, Direct, Referral, Email, Unassigned and `(not set)`. Channel queries paginate and fail rather than silently truncate. Sessions are not summed into user totals. Channel attribution does not establish incremental paid-ad impact.
- Daily sessions/key events are displayed and charted only for returned dates; missing dates and metrics are not filled with invented zeros. The landing-page report was removed from this dashboard; fresh snapshots retain an empty legacy `pages` field without requesting that report. No demographic/advertising-personalization data is requested.
- Requests stay within GA4's ten-metric limit. Sampling, privacy thresholding, `(other)` data loss and restricted-metric notices are surfaced; limited snapshots suppress confident summary interpretation. Missing/invalid numeric values stay unavailable. Malformed/incomplete headers, duplicate dimension rows, pagination gaps and timezone changes fail closed.
- Summaries are deterministic descriptions of observed figures, reusable across all clients. Rate differences use percentage points; zero baselines do not become infinite percentage changes. They do not diagnose tracking, creative quality or channel causality. No LLM or external provider call runs during page load.

## Storage, access and rollout

Migration `20261122000500_website_dashboard` creates at most one snapshot record per client/window. It is owner-only, bound to both property ID and a hash of the current GA4 refresh grant. Reconnecting a different grant invalidates prior cache; disconnect hides all cached website data. Refresh writes compare the linked property, owner, grant and lease identity again, so relink/disconnect during an in-flight fetch cannot publish data for the wrong property. Cached reads return no refresh/access tokens or connection hashes.

Refreshes require a verified active account, use a per-window five-minute cooldown and six-minute lease, and are triggered manually in this first release. No scheduled GA4 emails or automatic background refresh is enabled. No report credits are consumed. OAuth needs existing GA4 or Google Ads fallback client configuration plus Admin/Data API access; a grant needs permission for the actual property. The new dashboard refresh path requires a successful grant refresh rather than falling back to an old access token.

Apply the migration through the normal build. After deployment, connect/link the NextReport website test client, refresh both windows, and compare the exact dates, timezone, totals, channels and rates against GA4 before wider rollout. Live GA4 credentials were unavailable in the development workspace, so provider acceptance and production parity remain owner acceptance checks. Automated tests and isolated responsive previews use fixtures/mocked APIs and do not change production data.


## Comparison and custom-date update

The overview now puts signed, metric-aware changes directly on six primary cards, including bounce rate. Falling bounce rate is green with its real negative numerical sign; rates use percentage points, counts use relative percent. Zero baseline is From zero rather than infinity. Stale/limited snapshots have neutral change colors. The former review badge, threshold explanation and duplicate narrative were removed from the screen.

Custom dates select 1–90 completed property-local days and compare with the immediately preceding equal-length period. Today/future/invalid/reversed dates are rejected. One bounded custom cache uses the existing Int days key 0; its snapshot carries the actual day count and custom mode. Presets remain keys 7/30. Date identity is checked before cache reuse; changing dates hides mismatching figures. The same five-minute custom refresh cooldown, owner checks, connection/property binding and publish CAS apply. No new database migration is needed.

Daily rows, landing pages and channel details request all ten core metrics, within the ten-metric API limit. Older snapshots parse with optional added detail fields; missing values remain — until refreshed. Detail tables default to key metrics and offer Show all metrics. The cached trend can switch among sessions, users, views, engagement, bounce and key events without a provider request. Daily users remain unique per day; they are not summed into period users.

Paid Social, Paid Search and other recognized GA4 paid-channel rows are highlighted when returned. No absent row becomes zero, and no Meta delivery metric is substituted for website traffic. Expected paid visits need correct campaign UTMs and, where applicable, Google Ads auto-tagging/property linking. An agency's connection to an ad account does not itself create paid GA4 sessions or identify every Paid Social visitor as Meta.

This core traffic/engagement/key-event overview does not infer revenue, purchases or business outcomes from key events. Ecommerce revenue reporting requires actual ecommerce instrumentation and is not manufactured from the available figures.

## Overview refresh

The selected website opens on Last 30 days. Ten summary cards show new users, active users, event count, key events, sessions, average session duration, page views, bounce rate, total users and engagement rate. Desktop uses five columns; mobile uses two. Active users and event count come from dimensionless current/previous GA4 reports, never sums of daily unique users. Their fields are optional in version-1 snapshots, so old saved reports remain readable and show — until refreshed.

The daily line chart exposes date/value axes and keyboard, pointer and touch inspection. Missing daily rows break the line rather than becoming zeros. It shows the current period only; previous-period daily values are not fabricated. All reporting sections remain visible. Channel tables show current users, views, engagement, bounce, key events and session duration; previous sessions and a single Change column carry the comparison. Most-viewed page titles replace the removed landing-page section, followed by the scrollable daily evidence table.

Additional top-ten country and page-title queries show active users by country and most-viewed page titles, respectively. Titles measure all page views; landing pages measure entrances and remain a separate report. New requests are staged in batches of at most five and each report requests at most ten metrics. Country/page-title arrays are optional in existing JSON caches; no database migration or new OAuth scope is needed. Existing property/grant ownership, cooldown, quality warnings and failure retention remain enforced.

Search Console is a proposed separate integration for organic search clicks, impressions, CTR, average position, queries and search landing pages. It is not implemented by this dashboard refresh and would require its own read-only authorization, client-site assignment and privacy handling for query data.

The report has one date-range/comparison summary and a short settling note. Country and page-title sections show the active timeframe (Last 7/30 days or Custom period with day count). Chart axes and point details retain the dates needed to read the visualization. GA4 summary cards use uniform styling with no decorative icons or colored strips; SEO styling is independent.
