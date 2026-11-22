# Central report review inbox

**Reports** in the app navigation, or **Report inbox** from Overview, opens `/reports`. This inbox contains scheduled Meta Daily/Weekly/Fortnightly/Monthly drafts across the signed-in owner's clients. Manual wizard reports remain on the client page.

## Workflow

1. Save a schedule on the client page and use Prepare now or an enabled recurring schedule. Saving schedules, viewing this inbox and refreshing never send client emails.
2. Use To do, Awaiting review, Ready to send, In progress, Needs attention or History. Search by client name. Counts include all matching runs, not only the latest five per schedule. Results are paginated in groups of 25, oldest first, so older unreviewed drafts stay discoverable.
3. Open Review / edit report and inspect its metrics, text, output and recipients. Optional source CSV/details use the existing owner-only download controls and 24-hour source retention. Mark the reviewed checkbox, then Approve report. The checkbox is bound to the displayed report digest; a changed version needs fresh review. Approval does not send mail.
4. Explicitly Send approved report. Email contains browser and PPTX links; if desired, add a Google Slides copy from Client schedule before sending. Recipients are the immutable addresses saved on that run, not a later schedule edit. Inbox actions reuse existing owner-scoped endpoints, exact-version approval checks and immutable delivery keys.
5. Delivery pending permits checking/retrying the same delivery only when the current approved digest still matches. Verify delivery means provider acceptance is uncertain: contact support and inspect provider logs before preparing another copy. It offers neither a new-send nor a skip action. Email accepted means provider acceptance, not confirmed inbox receipt.

Editing an unsent approved report revokes its approval through the existing editor. Skipping is deliberate and does not recall sent mail. History contains accepted and skipped runs; sent browser links retain the existing post-send edit behavior. Public links are not exposed for unapproved or mismatched unsent versions. Invalid saved settings are isolated to the affected row, with approval/sending unavailable; private summary JSON, storage paths and raw saved settings are never returned by the inbox API.

## Operational notes

The inbox does not configure timers, enable schedules or change provider quotas/recipients. If recurring preparation is inactive or its heartbeat is overdue, the UI says so; paused schedules and Prepare now remain usable. The five-minute scheduler activation and real Meta/Resend/Drive acceptance steps in [scheduled report drafts](scheduled-report-drafts.md) still apply. No database migration is required for this inbox.

`GET /api/report-inbox` is authenticated, owner-scoped for both counts and rows, private/no-store, and validates view/search/page inputs. Search is capped at 100 characters and pages at 10,000. The page refreshes on focus and polls every 10 seconds while visible work is in progress. Stale fetch results cannot overwrite a newer filter response. It makes no Meta or email-provider requests when opened.

Tests cover owner scope, pagination/clamping, private projection, changed approval digests, invalid settings, uncertain delivery, terminal runs and existing approval/email guards. Browser checks use mocked drafts and all mutation endpoints; they do not send real emails or prove production provider delivery.
