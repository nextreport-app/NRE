# Phase 2 implementation completion and activation

The agreed core Phase 2 implementation is complete after the final hardening PR is merged. This does not mean production provider parity, recipient delivery, or native Office/template acceptance has been verified. Those require the connected production services and the owner's consolidated review.

## Implemented

- Meta portfolio overview with objective-aware campaign/account decisions, actual comparison values, saved efficiency targets, qualified positive/neutral states and explicit missing/stale coverage.
- Approved monthly budgets excluding tax, projected over/underspend, tolerance, final-week urgency and remaining daily allowance. Read-only monitoring informs an operator; it does not cap spend or modify campaigns.
- Owner warning notifications with delivery intent guards, new/continuing/recovered issues, deduplication and critical escalation; explicit due-account refresh and daily background sweeps.
- GA4 website overview with 7/30-day property-local comparisons, unique period users, traffic channels, daily trend, landing pages, evidence-based observed changes and prior-channel drill-downs.
- Daily/Weekly/Fortnightly/Monthly scheduled Meta drafts, private source verification, report-credit admission, exact-content review/approval, and explicit client send. Central all-client Report inbox, with ambiguous deliveries held for review.
- Compatible agency PPTX design upload, sample review/approval and per-client assignment; retained design revisions support older reports. Arbitrary existing agency decks still need adaptation to the compatible starter structure.
- Immutable agency logo revisions: replacing/removing the profile logo affects future reports; saved browser reports retain their referenced private revision. Same-format reuploads work without overwriting old assets. Preview is private/no-store, and saving stays busy through logo upload/removal.
- Optional external scheduler runner and bounded recovery of existing email delivery intents. Its heartbeat reflects a completed tick, rejects future/stale timestamps and requires actual cron configuration.

Creative reporting remains Beta/on hold by the owner's instruction. Other ad-platform reporting remains hidden. GA4 in-app refresh is manual; no new GA4 email/background subscription was introduced. Bespoke per-schedule ad-set/metric presets and unrestricted PowerPoint layout conversion are outside the delivered core scope.

## One-time recurring scheduler activation

The existing Vercel daily cron configuration cannot provide five-minute draft preparation. `.github/workflows/report-scheduler.yml` supplies an optional runner without requiring a frequent Hobby cron. It remains disabled unless explicitly opted in.

1. On the app host, create a new private high-entropy `REPORT_SCHEDULER_CRON_SECRET` and set `REPORT_SCHEDULER_ENABLED=true` only when ready to test activation. Leave the existing `CRON_SECRET` used by other automations unchanged. Redeploy the Production application after adding the variables.
2. In this repository's Actions secrets, set `REPORT_SCHEDULER_CRON_SECRET` to the same new value. Do not put the secret in chat, a URL, a workflow file or a repository variable.
3. In repository Actions variables, set `NEXTREPORT_SCHEDULER_RUNNER_ENABLED=true`. Run **Report draft scheduler** manually and confirm success, then observe scheduled ticks. Disable that variable to stop this runner. The checked-out code always comes from the default branch; the endpoint destination is fixed HTTPS and redirects are rejected.
4. Confirm a fresh heartbeat on the client schedule screen before enabling one paused test schedule. Preparation starts at a worker tick; email still requires review, approval and an explicit send. A successful heartbeat indicates a reachable worker, not that every report/email succeeded. Check remaining backlog and failed email counters.

The dedicated app key takes priority for this endpoint. If it is blank, legacy setups continue using the existing global `CRON_SECRET`. Never replace the global key just to activate report scheduling. A separate manual walkthrough is in [scheduler activation](scheduler-activation.md).

GitHub scheduled workflows are best-effort and can be delayed. A five-minute schedule creates approximately 8,640 runs per 30-day month; private-repository runner usage may exceed included minutes. Check the repository plan and budgets before opting in. A suitable external scheduler or hosting plan can call the same protected endpoint instead; if choosing another timer, leave this GitHub runner disabled. Never run overlapping timer providers intentionally.

The runner retries only previously queued immutable email intents. It does not approve drafts or create a client send from a READY report. Existing verified-owner, subscription, current-report, recipient and Resend idempotency guards still apply. Free Resend can remain in use if actual quotas permit the planned volume; code does not assume a paid upgrade or guaranteed inbox delivery.

## Branding retention

Published report summaries hold private logo URLs. Old revisions are intentionally retained when the profile logo is replaced or removed, including across file formats and concurrent updates. They are not throwaway caches. This patch does not add an automatic logo garbage collector: safe collection needs report-reference and in-flight-job lifetime handling. A failed upload/profile update may also leave an unreferenced private revision; do not blindly purge the agency-logo prefix. Existing report/blob retention behavior is otherwise unchanged. Assets already removed by the former behavior cannot be recovered by a code change.

## Consolidated owner acceptance

1. Express Text Meta: enable monitoring, Check Meta and budget, compare exact account-local periods with Ads Manager; verify the two objectives remain separate, targets, positive/review/critical observations and over/underspend notices. Check source freshness and an owner-controlled warning email.
2. NextReport website client: link GA4 property 552954256, separately from Express Text. Refresh both windows and compare exact totals, rates, channels and dates against GA4. Check organic/direct/paid views and limited-data notices.
3. Prepare one draft for each cadence. Inspect fresh source CSV, browser report and PPTX; confirm periods, recipients and branding. Edit an unsent approved draft and verify fresh approval is required. Send only to an owner-controlled recipient during acceptance, check provider logs, and test optional Drive/Slides output.
4. Review a restyled compatible agency design in actual PowerPoint and Google Slides, including Light template. Replace/remove the agency logo and verify old browser reports keep the prior revision while new reports use current settings.
5. Confirm recurring timer heartbeat and one enabled schedule, then review backlog, provider quotas and timing before widening activation. Existing native Office/real Blob/provider acceptance is not replaced by mocked tests.

No additional feature expansion is required to call the agreed core implementation complete. Remaining work is merging the final PR, production activation and this acceptance pass; issues found there should be fixed generally rather than patched for a single client's report.
