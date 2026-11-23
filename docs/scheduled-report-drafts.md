# Scheduled report drafts (Beta)

Client Manage → Scheduled reports. One Daily, Weekly, Fortnightly and Monthly schedule per client. Meta API only; manual CSV workflows stay in the wizard. Daily uses yesterday, Weekly the previous seven completed account-local days, Fortnightly the previous fourteen, and Monthly the previous full calendar month. Daily and Fortnightly use the tested day-by-day table format, with each objective kept separate; their cover does not include monthly budget pacing. Dates are anchored to the due occurrence, including when a worker is late. Monthly start days are limited to 1–28. Fortnightly preparation repeats every 14 local dates from its saved first-preparation date. The form previews the next occurrence. DST folds use the first occurrence and gaps advance to the first valid minute.

All-client review is also available in [Report inbox](report-review-inbox.md); existing per-client controls remain available.

## Agency workflow

1. Link the client's Meta account and save a schedule, recipient emails (maximum five), local start time, and optional exact campaign names/cover budget. Blank scope means all campaigns. Current client template and agency branding apply at preparation. Weekly/Monthly use campaign-level, objective-based metrics; Daily/Fortnightly use account-level day-by-day tables with objective-specific results. Configure custom detail reports in the wizard.
2. Use **Prepare now** on a paused schedule to exercise the workflow. It prepares a report for the cadence’s period ending before today (or the previous calendar month), not a preview of a future occurrence. Normal verification, subscription, concurrency, complexity and report-credit limits apply. Empty or unreconciled data fails rather than becoming a zero report.
3. The agency owner receives a ready/failure notice. Review in the existing editor and download PPTX/source CSV. Source retention is 24 hours. Public browser/PPTX/logo routes reject drafts; Drive exports and normal send-email are blocked for unapproved drafts. Generation does not trigger Slack/Zapier/webhook delivery for scheduled drafts.
4. Check **I reviewed the report and recipients**, then approve the exact saved version. Approval makes its browser/PPTX links available. Optionally save the approved version to Google Drive for a Slides link, then explicitly **Send approved report**. Email includes links, not file attachments. Approved copies are not emailed automatically. No client mail is sent merely by saving or enabling a schedule.
5. Schedule edits affect future drafts only. Skip an existing draft and prepare a new one to change its recipient list. Editing an unsent approved report revokes approval; browser/PPTX edits are saved together. Sending/provider-review states block edits. A sent report remains editable through the normal editor, which also changes what recipients see at its live URL.

“Email accepted” means Resend accepted the request, not that an inbox received it. Existing durable email delivery uses one immutable message key per run and provider deduplication. An ambiguous send beyond the safe retry window becomes **REVIEW**: verify Resend logs before creating another copy. Skipping cannot recall a sent message. Pausing stops future preparation; explicitly skip drafts already underway to discard them. A worker already generating may finish privately after a skip.

## Deployment and activation

- Apply migration `20261122000300_scheduled_report_drafts` and regenerate Prisma (normal deployment build does both).
- Keep `REPORT_SCHEDULER_ENABLED=false` until the timer is installed. Paused schedules and manual preparation work in this state. This PR does not configure production timers, Meta credentials, Resend, or send any real email.
- Install a scheduler that supports an authenticated HTTP GET **every five minutes** to `https://nextreport.in/api/cron/report-schedules`, with `Authorization: Bearer <REPORT_SCHEDULER_CRON_SECRET>` (legacy fallback: `CRON_SECRET`). Use a private scheduler secret/header configuration, never a public URL query parameter. This cadence needs an external scheduler or an appropriate hosting plan; the existing daily fallback cron is insufficient. No unsupported frequent Hobby cron is added.
- Set `REPORT_SCHEDULER_ENABLED=true`, invoke the protected endpoint and confirm a recent successful heartbeat. UI only allows enabling schedules with a heartbeat newer than 20 minutes. A saved time means preparation starts at the next worker check, not guaranteed delivery at that minute. Monitor endpoint failures and stale heartbeats externally; the UI surfaces stale health when opened.
- The worker atomically enqueues occurrences, leases preparation, and resumes existing jobs without a second report reservation. If downtime missed multiple occurrences, only the latest due occurrence is prepared. Each tick admits up to ten schedules and examines up to fifteen eligible pending runs; monitor backlog and increase worker capacity before onboarding high volume.
- Configure Resend with the verified sending domain and monitor actual account quotas. No plan upgrade is required by code, but owner notices plus client delivery both consume provider limits. Review real limits before enabling many schedules. Retain the existing email retry cron alongside this worker.
- Acceptance before activation: prepare a Weekly and Monthly Express Text draft, compare fresh source CSV/browser/PPTX, edit/reapprove, test one owner-controlled recipient and optional Drive copy, then enable one schedule and verify the timed draft/notice. No connected production Meta/Resend/database credentials were available for this development session; these live checks remain necessary.

## Follow-up scope

Bespoke metric/ad-set presets, other platforms, automatic Drive-folder setup and unattended client delivery are not in this first release. GA4/agency dashboards and performance alerts remain separate Phase 2 tasks. Creative reporting remains Beta.

## Daily and fortnightly acceptance

Daily fetches only yesterday’s source. Fortnightly fetches exactly the previous 14 completed dates, with no rolling chart or MTD expansion. Both use the existing day-table builder and CSV reconciliation before reserving a report credit, and the existing DAY_BREAKDOWN worker, custom template and agency branding. The approved browser report is a day-by-day table over the same dates; the scheduled report name/PPTX cover identify its cadence. Sparse API delivery dates stay sparse rather than inventing source observations. An empty/unreconciled window fails privately and does not create a zero report for delivery.

Every prepared draft consumes the normal report allowance; daily schedules can use it quickly. Existing subscription/concurrency limits apply. These cadences remain subject to the same review, approval and explicit-send process. No schedule is enabled by this release and no client email is sent by saving a schedule. Monthly budget pacing stays available in Overview and on Weekly/Monthly covers.

Latest-due recovery now searches the calendar directly instead of iterating a capped number of missed occurrences, so daily schedules recovering from more than 400 missed cycles prepare only the newest due period. Existing Weekly/Monthly schedules retain their saved times and periods; no database migration is needed because cadence/settings are stored as strings/JSON.

Before enabling either new cadence in production: prepare one Daily and one Fortnightly draft, verify account-local dates, source/PPTX/browser parity, recipients and branding, then test owner-controlled delivery. The external five-minute timer and provider acceptance gates above still apply.

The final hardening release includes an optional opt-in GitHub runner, successful-tick heartbeat validation and bounded retry of existing email intents. See [Phase 2 completion and activation](phase-two-completion.md) for exact private settings, Actions usage considerations, activation steps and the consolidated owner acceptance pass. Existing Vercel daily crons are not a substitute for that frequent scheduler.

## Scheduling navigation

- **Reports → Manage schedules** opens `/clients?task=schedule`, a client chooser whose primary action is **Schedule reports** rather than Generate report.
- Every client card also exposes **Schedule reports** directly. The destination is the owner-scoped `/clients/[id]/schedules` page with links back to the inbox, one-off generation and client settings.
- The Meta report wizard exposes **Schedule reports** on Import, Campaigns, Metrics, Review & generate and the completed report screen. Its existing leave guard confirms navigation away from unfinished work. Client settings still open in a new tab, preserving wizard inputs. The completed report screen also links to the central draft inbox.
- Recurring settings are independent of one-off report inputs. They use fresh Meta API data; uploading a CSV or selecting an audience breakdown does not silently configure a recurring report. Available cadences remain Daily, Weekly, Fortnightly and Monthly.
- For a client without a linked Meta ad account, connect Meta in Account and complete one API sync on Import. This links the account; generating a report is not required. The persistent Schedule reports shortcut returns to the scheduling screen. Client settings do not contain an account-link field.
- Schedule status can be refreshed explicitly and stale health displays the last completed tick. A green manually dispatched GitHub run does not prove recurring scheduled events have started. Paused schedules and manual Prepare now remain available while recurring-worker health is stale.

## Preparation time, recipient delivery and timezone

A saved paused schedule does not execute at its saved time. It can be tested with Prepare now. An active schedule requires a healthy recurring worker; a manually successful tick is not evidence that recurring ticks have started. Draft preparation is queued at the selected cadence/day/time and may finish later. This time is not a promised recipient email arrival time.

Draft-ready/failure notices go to the account owner's email. The form's report recipients are used only after exact-content review, approval and explicit Send approved report. Saving, preparing and approving must not automatically send a client email.

The reporting calendar uses the linked Meta ad account's `timezone_name`, not IP country, browser location, agency location or the recipient's address. Successful API sync persists that timezone on the client; preparation fetches account metadata again and rejects a mismatching timezone/currency. Manual CSV client calendars remain explicitly configured. Do not silently change an existing schedule when the account/calendar changes: edit and save it again. GA4 separately uses its property's timezone.

The UI shows a weekday and full next-preparation date. For example, on Sunday Nov 22 at 23:02 Chicago, a Monday 23:05 weekly schedule is due Monday evening, not three minutes later. Paused schedules display a fresh hypothetical next occurrence, not a stale stored date. Historical run timestamps use their saved timezone.
