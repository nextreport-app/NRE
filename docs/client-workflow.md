# Client workflow

My Clients (`/clients`) is the common signed-in starting point, including Home's Dashboard action and login without a destination. It is a chooser, not another configuration screen.

| Job | Portfolio entry | Selected client |
| --- | --- | --- |
| Performance and alerts | `/performance/meta-ads` | `/performance/meta-ads?client=ID`; Website traffic tab keeps the client at `/performance/google-analytics?client=ID` |
| Generate a one-off report | My Clients → Generate report | `/clients/ID/reports/new` |
| Recurring reports | `/clients?task=schedule` | `/clients/ID/schedules` |
| Find generated reports | `/reports` → All reports | `/clients/ID/reports` includes filters and management tools |
| Approve scheduled delivery | `/reports?tab=scheduled` | Review draft, then return to Scheduled drafts to approve |
| Client configuration | My Clients → Client settings | `/clients/ID#client-settings` |
| Agency configuration | `/account` | Not client-specific |

The report wizard's Import, Campaigns, Metrics and Review steps are one generation workflow. Report review (`/clients/ID/reports/REPORT/copy`) and public sharing (`/r/TOKEN`) are secondary views, not additional setup tasks. The standalone website report route remains supported for existing links.

## Navigation corrections

- General Dashboard/login entry points consistently lead to My Clients. Explicit local login destinations preserve the client and query string.
- My Clients is the client task launcher: one primary Generate report button plus More tasks with descriptions for Performance, Report scheduling and Client settings.
- Task pages do not repeat a cross-task toolbar. The wizard shows its step progress and a guarded Change client link. Performance keeps platform tabs and All accounts/All websites returns; scheduling and settings return to My Clients.
- Scheduling selects an unlinked Meta ad account inline, without an Account settings or report Import detour.
- Failed or disconnected GA4 clients link directly to their own property/connection settings. Error views suppress the generic first-refresh instruction and retain stale-data warnings.
- Reports previously exposed scheduled runs alone. Its default is now generated history across clients, with a separate Scheduled drafts tab preserving the existing approval workflow.
- Settings links to the canonical budget/alerts panel and schedules screen instead of embedding duplicate management widgets. Existing section anchors continue to work.
- Legacy client edit URLs redirect to canonical settings after ownership verification.
- Report review returns to its originating area. Private comparison drafts do not expose a public share token in their rendered review.
- Client history pagination is clamped before fetching rows.

## Validation and scope

Focused tests cover signed-out redirects, local callback validation, preserved client context, report ownership, private draft review, pagination and scoped navigation. Existing schedule, inbox, download and share-review tests verify approval/delivery boundaries remain intact. Mocked browser checks cover client launcher destinations, keyboard dismissal, inline schedule account assignment, wizard leave guards, and desktop/mobile GA4 portfolio, detail, disconnected and error states.

This is a source/route and mocked-data audit. It does not claim a live production signup, payment, Meta consent, GA4 consent or actual email delivery test. No production client assignments, schedules, provider data or emails are changed during verification.

Legacy `/overview` and `/websites` permanently redirect to the corresponding `/performance/` routes, preserving query parameters. All dashboard routes remain private and excluded from search indexing.

Meta Ads, GA4 and Search Console share the same navigation structure: choose a client on the platform's portfolio, then view only that client's dashboard. A dedicated return row above the heading leads back to that platform's portfolio; it stays separate from the platform tabs. Switching platforms preserves the selected client. Meta portfolio selections also use a client-specific URL, so reload and browser history retain the correct scope. Selected-client dashboards do not include an all-client switcher.

All three performance dashboards open on Last 30 days. On entering a Meta client dashboard, its saved comparison setting is reset to 30 days if necessary through the existing comparison endpoint, which invalidates the prior snapshot. Normal refresh then loads the new range. In-visit changes to 7 days or custom dates remain in effect until the dashboard is reopened; portfolio visits do not reset other clients. GA4 and Search Console already initialize their local date-range controls to 30 days.

Meta status and notification rules:

- Account status is the highest severity across fresh campaign and budget checks: Critical, Review, Improvement, then neutral/setup/data states. A warning always outranks an improvement within a campaign. Accounts can show Review/Critical plus a separate Improvement badge for other improving campaigns. Saved target compliance is neutral, not proof of improvement. Mixed-objective account totals never override campaign warnings.
- Actual monthly overspend beyond the configured tolerance is Critical. Month-end forecasts use completed-day spend divided by completed days, multiplied by calendar-month days (at least three completed days); material projected overrun is Review even in the final week. Approaching/reached budgets and material underspend are Review. Budget forecasts are estimates, not actual overspend.
- Performance rules retain evidence safeguards: CTR -20% and CPC +25% are Review; primary results -30% with broadly maintained spend are Review; severe result collapse (-60%, at least three lost results, prior baseline five) or doubled result cost are Critical with continued spend and minimum delivery. Missing evidence never becomes zero.
- Independently of the displayed 7/30-day window, the last seven completed days are checked for zero objective-specific results and meaningful spend: at least 500 impressions and spend of at least three times the previous result cost (baseline five results) or a saved cost target. This recent-window evidence and its dates are stored in the snapshot and reused by UI and email. Historical custom ranges do not trigger automatic email.
- Improvement requires existing evidence-backed change signals plus meaningful thresholds: CPR -20%, results +25%, purchase ROAS +20%; supporting CTR +30% or CPC -25% additionally requires maintained primary outcomes and stable result cost. Target-met/recovery signals do not qualify.
- Critical email is automatic while the relevant monitor is enabled; review-warning email is optional. Detection and send-time validation share the current signal rules. Performance keys include account/config/window and a stable campaign/signal fingerprint, so the same incident set is deduplicated and newly critical campaigns can trigger another alert. Budget keys distinguish critical escalation from a prior warning. Pending messages are revalidated against current account ownership, preferences, monitoring, account/config and fresh evidence; resolved/obsolete alerts are cancelled.
- The opt-in `.github/workflows/monitoring-alerts.yml` runner checks budget/performance and retries only monitoring mail once an hour, up to 50 oldest-due accounts per monitor invocation with existing concurrency/lease limits. Activate with repository variable `NEXTREPORT_MONITORING_RUNNER_ENABLED=true` and secret `MONITORING_CRON_SECRET` matching deployed `CRON_SECRET`. Existing Vercel daily fallbacks are retained to avoid unsupported subdaily Hobby crons. Delivery requires configured CRON_SECRET/Resend; notification latency depends on check backlog, provider reporting, rate limits and mail-provider acceptance. Tests use mocked providers; no production email is sent during verification.
