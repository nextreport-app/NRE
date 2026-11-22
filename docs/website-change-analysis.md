# Website change analysis

The GA4 website dashboard now leads with **What changed** above the metric cards. It describes observed sessions, engagement and the share of sessions with a configured key event. Positive and adverse observations can coexist as Mixed changes. It does not diagnose tracking, creative quality, website quality or channel causality, and does not assume that every key event is a lead or purchase.

## Evidence rules

- Engagement-rate interpretation needs 100 sessions in each period and at least a 5 percentage-point change.
- Key-event-rate interpretation needs 100 sessions in each period, at least 5 prior key events and at least 5 prior key-event sessions implied by reported rate × sessions. This derived quantity is only an evidence gate, never displayed as a reported count. An improvement also needs 5 current key events/key-event sessions. Normal rate signals require both a 20% relative change and 0.5 percentage points. A reported zero key-event rate with zero key events and at least 80% of prior session volume is a separate review signal.
- Session decline needs at least 100 prior sessions and a 30% fall. Growth needs 25% and a known engagement rate no more than 3 percentage points below the prior period. Traffic growth alone is not business success.
- No threshold crossed requires enough comparable sessions, event evidence and rates. Low-volume or missing data is not treated as neutral performance. Configured event definitions still need the agency's judgement.
- GA4 quality warnings or stale/failed snapshots suppress confident change signals. Rates use percentage points; zero/missing baselines do not become infinite relative changes. Recent GA4 data may take 24–48 hours to settle.

The existing factual summary is retained under collapsed **All reported changes** to avoid duplicating the first-screen explanation. No LLM, new notification subscription, email or background refresh is introduced.

## Channel comparisons

Both completed property-local periods now request the full paginated session-default-channel report. Known absolute session changes sort first; channels only reported in one period remain visible with the other value unavailable. Missing rows are not invented zeros and missing metrics stay unavailable. A genuinely reported zero baseline is labelled From zero / 0→0 rather than an infinite percentage. Small nonzero percentages retain their direction instead of rounding into unchanged values.

Open a channel to compare sessions, engagement rate, key-event count and session key-event rate. User counts are never summed across channels. GA4 channel attribution is independent of Meta campaign attribution, and Paid Social need not be exclusively Meta.

Previous-channel rows are an optional additive field in the existing version-1 JSON cache: older snapshots remain readable and ask for a refresh to load channel baselines. A successful snapshot under five minutes old can still be reused by the existing cooldown; wait for that interval before refreshing a legacy snapshot. No database migration is needed.

Adding the prior channel query does not raise each snapshot's existing five-concurrent-request peak. Both prior/current channel pagination and metadata warnings are checked; incomplete/duplicate prior data fails the refresh instead of publishing a partial comparison. Existing property/grant-bound ownership, quotas, leases and failure retention stay in force.

The client selector additionally binds the displayed snapshot to the server-selected client and invalidates obsolete fetches, preventing cached data from another client appearing under a new selection.

## Acceptance

Automated tests cover data separation, prior-only warnings/duplicates, pagination, concurrency, rate maths, zero/missing values, evidence thresholds and legacy caches. Browser tests use mocked GA4 data/actions at desktop/mobile widths, including stale/limited snapshots and client isolation. No production properties were linked and no real GA4 calls were made during these checks.

For production parity, use the separate NextReport website client/property 552954256 and compare both windows, current/prior channels and exact property-local dates against GA4. Keep this property separate from Express Text. The live acceptance gate from website-performance-dashboard.md remains outstanding.
