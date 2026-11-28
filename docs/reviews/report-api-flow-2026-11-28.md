# Report API flow audit — 28 November 2026

Scope: Meta API sync → analysis/session → campaign/objective/metric selection → preview/verification → generation/worker → status → owner download/browser sharing. This is a code review and automated/mock-provider verification, not a production account acceptance test.

## Findings fixed

- PR #898 aligned custom weekly coverage validation with the imported calendar. Explicit uncovered dates and stale rolling presets remain blocked; paused/sparse activity does not erase query coverage.
- Pin weekly presets to the explicit week returned by analysis after API sync. Preview and generate keep the imported week when the calendar advances. A newly requested period still needs fresh data.
- Going back to Import/Campaigns no longer discards metric choices simply because it is backward navigation. Changing account/source still clears imported state. Same-account resync keeps explicitly selected campaigns/ad sets and restores objective/metric choices against the fresh available metric pool. Missing selected campaigns are not replaced with default campaigns when none remain.
- Starting a new sync invalidates the previous source/session, preview and visited downstream steps. A failed refresh cannot silently reuse old data. Analysis failures preserve the server’s useful error message.
- Polling retries transient network/408/429/server/malformed-response failures, bounded by three consecutive failures and the overall attempt limit. Authorization/not-found errors stop immediately; status requests bypass caches.
- Retrying a known pending report after polling failure resumes its status checks rather than POSTing another generation. Confirmed FAILED jobs clear that pending state and can be generated again. Actual failure messages no longer claim the job might still complete.

## Reviewed boundaries

| Stage | Evidence and behavior |
| --- | --- |
| Sync | Owner/subscription/account confirmation guards; account currency/timezone; query metadata; no current-active-only filter on historical insights. Meta sync integration and API mapping tests pass. |
| Analysis/session | User/client-scoped sessions, validation, TTL and report-choice matching. API evidence remains available until its existing TTL. |
| Preview/generate | Shared date coverage, engine configuration and independent source verification. Mismatches prevent generation; no invented missing-day observations. |
| Worker | Authenticated dispatch, fallback dispatch, atomic claim against duplicate rendering, capacity limits and failure-credit refund behavior reviewed. |
| Status/download | Owner checks, no incomplete download, completed report token returned only after completion. Route tests pass. |
| Sharing | Browser share/link review protections, private automation sample and scheduled report restrictions remain intact. Sharing route tests pass. |
| Links | Import recovery step, report history/resume, owner download, browser report/editor, public report, automation, client settings/provider/previous-month anchors and download-help destinations exist. Route/navigation tests cover ownership and readiness; existence is not a live provider reachability guarantee. |

## Validation

- API route suite: 344 passed.
- Reporting accuracy suite: 532 passed, one skipped.
- Meta API suite: 182 passed.
- Report choices suite: 311 passed.
- Upload-session/job/polling tests: 22 passed.
- Additional polling and date-coverage regressions pass. These suite counts overlap and are not a unique-test total.
- Real wizard hook/components with mocked APIs: weekly/monthly, light/dark, desktop/mobile; setup, campaign/objective selection, metric editing, verified sample, explicit activation and no client send. Injected three status-service failures, retried the same report and asserted only one generation POST; returned to Import, re-synced and verified choices survived.
- TypeScript, targeted polling ESLint and diff checks. Existing hook lint diagnostics were compared with the base; new diagnostics are reported separately from changed-module checks.

## Limits and operational follow-up

No production jobs, migrations, emails or client data were accessed. Live Meta token validity, the specific Unstoppable 365 import, Google Drive authorization, deployment protection and worker/storage availability require an authenticated production check. A dropped generation POST before its response remains an uncertain outcome: the wizard tells the user to check report history before retrying. Pending-report recovery is in-memory; a page reload relies on report history. Do not treat these checks as proof that external services cannot fail or that this change has been deployed.
