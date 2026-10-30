# Customer report recovery and automatic investigation

This extends PR #619. The Guardian still detects discrepancies; the recovery flow now retains bounded private evidence, automatically rechecks and queues eligible cases, exposes honest customer progress, and reconciles deployed fixes. New code changes still require a draft PR, review and merge. No automatic deployment or customer email is introduced.

## Customer flow

1. A Meta preview mismatch creates a case bound to owner, client, file and calculation settings. Relative periods also include the client's local as-of day. Fixed custom periods remain stable across days. Different objective/metric selections, CSV alignment mode or dates cannot resolve each other's case.
2. The wizard shows **Investigation queued** and automatically rebuilds/rechecks once per case per browser session. This uses the same source/settings, does not create a report or reserve a report credit, and does not prewarm additional AI insight calls. It never changes the objective, date range or counting method merely to make checks pass.
3. The customer can see states: queued → investigating → candidate awaiting review → update live/recheck → listed checks verified. An unsuccessful repair becomes **Further investigation needed**; it does not ask for a duplicate explanation. Polling is bounded to 15 visible-tab checks at 20-second intervals; the customer can check status manually afterward. A running case with no update for an hour is shown as pending/stale, not endlessly “fixing”.
4. The generation endpoint independently reconciles supported standard, comparison, multi-month and day-table candidates before reserving capacity/credits. An actual mismatch returns 409 and no new report credit is used. The wizard also disables generation while its current checks disagree. Skipped checks or missing-date coverage alone do not count as numeric mismatches. Legacy previous-month-summary generation is not newly covered by this gate.
5. A passing nonempty **server-generated** verification for the same context resolves the case; no worker callback can set VERIFIED. This also resolves matching cases after a fresh upload of the same file/settings. Worker failure callbacks cannot downgrade a verified case. A fresh discrepancy in an already verified case reopens review instead of claiming success.
6. A review candidate is not displayed as live. The monitor checks that GitHub reports the PR merged and that its merge commit is an ancestor of the live production revision reported by the application. The application independently requires the exact current production revision and the case's stored PR number. Only then can READY_TO_RECHECK be shown. Existing downloaded decks never change; preview revalidation and a newly generated deck are still required.

This is recovery for **existing cross-check coverage**, not an assertion that every metric/card/visual is independently verified. Missing source-backed CTR/CPC numeric displays are now included in existing rate checks instead of silently skipped. No calculation tolerances are loosened. Private CSV values and names are not supplied to the coding model, so some bugs cannot be reproduced automatically and must stop for review.

## Evidence and privacy

- No new raw CSV copy is retained. Existing private wizard uploads still follow their existing 24-hour lifetime; expired uploads may need to be re-uploaded.
- A bounded diagnostic snapshot contains controlled schema keys/row count/missing-value flags and up to 64 displayed comparison pairs, each value capped at 100 characters. Source row contents, campaign names, ad account IDs, user messages and arbitrary CSV header names are not copied into this snapshot. Comparison display values remain private in the application database.
- Snapshots are cleared by the daily purge cron seven days after the last detection; minimal incident metadata is retained under the existing 90-day policy. User and client deletion cascade through their cases and attempt references.
- The read feed explicitly rebuilds an allowlisted diagnostic profile. **It does not return diagnosticsJson or the private comparison values.** GitHub/model evidence consists only of controlled categories, source row count and missing-value flags. Original CSVs, customer names, financial values and private diagnostics are not copied into issues, prompts or committed regression tests.
- Customer status is session-authenticated, scoped to both owner and client, no-store, and does not expose developer PR URLs or diagnostic contents.

## Automatic intake (no customer-created issue/label)

With `NEXTREPORT_REPAIR_ENABLED=true`, the daily Guardian and the hourly repair-selection job create redacted issues and apply the internal ready label for eligible QUEUED Meta mismatches with valid diagnostic profiles. Existing investigation issues can be upgraded automatically. Already verified cases are skipped; already attempted/running/review cases are not automatically requeued. Production issue labels are implementation details; customers and the owner do not need to apply them for new eligible cases.

The coding agent must establish a synthetic reproduction using trusted repository fixtures, not invent a fix from the signal alone. Insufficient evidence or out-of-scope changes stop with review needed. Passing candidates still require a new test that fails on baseline and passes with the change, broader release checks, clean verification and the separate publishing job.

The repair workflow can be manually run with an empty issue-number input to process captured cases. Maintainer-supplied issue numbers remain available for specific synthetic regressions. Internal labels remain for queue bookkeeping and compatibility, not as a required customer action.

## Required activation after this PR

1. Merge and deploy normally, including the schema migration. Existing Guardian/read/API credentials remain unchanged.
2. Generate a **new** random secret, at least 32 characters. Add the SAME value as `QUALITY_AGENT_WORKER_TOKEN` to Vercel Production and GitHub Actions secrets. This stronger credential can reserve work and update investigation states; do not reuse the read-feed token. Redeploy Vercel after adding it.
3. Leave or set Vercel `REPORT_REPAIR_DAILY_LIMIT=1` (default). The server enforces a global UTC-day allowance using an atomic transaction, durable usage bucket, per-run lock and unique workflow run/attempt key. Duplicate reservation requests do not consume another slot. A GitHub workflow rerun has a new attempt number and is counted again. The configured limit is clamped to 1–3.
4. After the updated production deployment is ready, set GitHub `NEXTREPORT_REPAIR_ENABLED=true`. Keep `NEXTREPORT_GUARDIAN_ENABLED=true`. Run Report Repair Agent once with the issue-number field empty. No pending case is a successful no-op and makes no model call.
5. A controlled, synthetic mismatch rehearsal can validate capture/recheck/status and quota behavior. Do not deliberately break production or use a customer file in a public test issue. The local test suite and smoke tests require no paid model calls. A live model/PR rehearsal still depends on configured service access and a genuine reproducible issue; do not claim this has been proven merely because local tests pass.

The first successful investigation can produce a draft PR. Review/merge remains an owner action. Status synchronization happens during hourly repair selection and daily Guardian intake, not instantly. GitHub schedules can be delayed. A configured worker that is disabled or at its allowance leaves cases queued; the UI does not promise that a repair is actively running.

## Cost and stop controls

- Every model attempt, including an unsuccessful one, can cost API credits. One permitted attempt can consume a material part of a $5 balance. The allowance and 14-minute model timeout are **not dollar caps**. Maintain separate OpenAI billing controls/usage alerts and disable automatic recharge if appropriate.
- The server reservation is mandatory before inference for both automatic cases and manually queued repository regressions. Missing worker configuration fails before a model call; exhausted allowance leaves the issue queued. Paid work has no automatic retry loop.
- No extra model key is put in Vercel. The worker credential is not a model credential. Publishing credentials remain in the separate fresh publishing job, never in model/test execution.
- Disable `NEXTREPORT_REPAIR_ENABLED` to stop future paid attempts and cancel any running workflow separately. The daily Guardian can continue detection and deployment synchronization. `REPORT_QUALITY_CAPTURE_ENABLED=false` remains the application's capture kill switch after redeployment.
- Cases that cannot be reproduced, fail gates or exceed scope become NEEDS_REVIEW; they are not silently recycled into another paid attempt. Production changes can create a new version-specific incident while the source/settings hash remains suitable for cross-deployment revalidation.

## Verification

`npm run test:quality-agents` includes context binding, privacy, lifecycle, daily reservation gates, candidate proof and synthetic publishing tests. `npm run test:api-routes` includes owner/client isolation and worker credential/state-schema boundaries. Local PostgreSQL smoke tests exercise concurrent reservation idempotence, quota rollback and candidate → production → verified transitions. Browser smoke tests exercise the initial automatic recheck, pending/investigating/review/live states and successful manual revalidation. Existing accuracy, report-type, objective and template contracts remain required.
