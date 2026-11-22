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
- Daily sessions/key events are displayed and charted only for returned dates; missing dates and metrics are not filled with invented zeros. Top ten landing pages use `landingPage`, excluding query strings. No demographic/advertising-personalization data is requested.
- Requests stay within GA4's ten-metric limit. Sampling, privacy thresholding, `(other)` data loss and restricted-metric notices are surfaced; limited snapshots suppress confident summary interpretation. Missing/invalid numeric values stay unavailable. Malformed/incomplete headers, duplicate dimension rows, pagination gaps and timezone changes fail closed.
- Summaries are deterministic descriptions of observed figures, reusable across all clients. Rate differences use percentage points; zero baselines do not become infinite percentage changes. They do not diagnose tracking, creative quality or channel causality. No LLM or external provider call runs during page load.

## Storage, access and rollout

Migration `20261122000500_website_dashboard` creates at most one snapshot record per client/window. It is owner-only, bound to both property ID and a hash of the current GA4 refresh grant. Reconnecting a different grant invalidates prior cache; disconnect hides all cached website data. Refresh writes compare the linked property, owner, grant and lease identity again, so relink/disconnect during an in-flight fetch cannot publish data for the wrong property. Cached reads return no refresh/access tokens or connection hashes.

Refreshes require a verified active account, use a per-window five-minute cooldown and six-minute lease, and are triggered manually in this first release. No scheduled GA4 emails or automatic background refresh is enabled. No report credits are consumed. OAuth needs existing GA4 or Google Ads fallback client configuration plus Admin/Data API access; a grant needs permission for the actual property. The new dashboard refresh path requires a successful grant refresh rather than falling back to an old access token.

Apply the migration through the normal build. After deployment, connect/link the NextReport website test client, refresh both windows, and compare the exact dates, timezone, totals, channels and rates against GA4 before wider rollout. Live GA4 credentials were unavailable in the development workspace, so provider acceptance and production parity remain owner acceptance checks. Automated tests and isolated responsive previews use fixtures/mocked APIs and do not change production data.
