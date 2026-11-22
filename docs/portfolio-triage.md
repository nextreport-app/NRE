# Account-first Meta triage

Plain sign-in and the public site’s signed-in Dashboard links now open `/overview`. Explicit valid local login return paths still take priority; the signup onboarding destination stays on Clients.

The Meta overview opens with a compact, urgency-sorted list of all owned clients and mutually exclusive account status counts. It reads saved snapshots without fetching Meta on page load. One account opens into the existing campaign evidence/settings view; changing the status filter closes unrelated details. Account rows show the leading campaign observation, current and comparison values, date ranges, timezone, check time and coverage. No currency or mixed-objective outcome totals are combined across clients.

## Status semantics

- **Critical / Review:** existing objective and budget rules from [the decision layer](objective-decision-layer.md). These describe observed issues needing investigation, not a diagnosis of their cause. Critical result stoppages outrank supporting click metrics.
- **Positive:** a qualified primary outcome improvement or an agreed efficiency target met. This is deliberately not an unconditional claim that an account is healthy or profitable. If other campaigns lack evidence, the row shows that coverage explicitly.
- **Neutral:** no alert threshold crossed, with comparable primary outcomes, at least 1,000 impressions and 5 results in each period, and available unit costs. It does not mean that every individual metric was unchanged.
- **Needs data:** a filter collecting refresh-needed, insufficient-evidence and no-delivery states. Those states retain their individual labels on each row. Missing snapshots, low volume, changed/unknown goals, and absent delivery are never inferred to be neutral.
- **Set up:** no Meta account linked or performance monitoring is off, unless a known budget risk already warrants attention.

Fresh adverse evidence takes priority over a missing source. Otherwise missing enabled-source freshness prevents an account from receiving a current positive/neutral verdict. A fresh positive campaign can coexist with low-volume campaigns, but the assessed/total and missing-evidence counts are visible. Future-dated budget snapshots are not fresh.

Target observations explicitly compare against the target; they are not labelled as previous-period values. Neutral/low-volume observations show available objective results without inventing percentage changes when the baseline is zero. Purchase ROAS retains exact action matching and campaign spend denominators from the prior decision layer.

## Refreshing accounts

The existing daily background sweeps remain unchanged. **Refresh due accounts** is an explicit owner action that queues only linked, enabled sources lacking fresh evidence. Rolling performance and budget checks use the existing owner-authorized endpoints, with at most two concurrent requests across the portfolio. Fixed historical custom comparisons are excluded and remain individually refreshable.

The control shows progress, per-source failures (including successful HTTP responses containing a failed snapshot), and work not started after stopping. Stopping prevents queued work from starting; in-flight checks finish. A failed account does not block others. Existing owner email opt-ins, delivery guards, five-minute cooldowns and server leases remain effective; this control neither enables monitoring nor changes recipients. Successful checks reload the overview. It does not modify campaigns, send client reports or create new notification subscriptions.

## Acceptance

Automated coverage checks neutral evidence guards, stale/missing and mixed-coverage accounts, target-versus-baseline values, source eligibility, concurrency, cancellation and failure isolation. Mocked desktop/mobile checks cover a 30-account portfolio and no initial Meta requests. Production comparison parity and actual provider email delivery remain deployment acceptance tasks; mocked UI validation is not evidence of live Meta/GA4 parity.
